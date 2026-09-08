package com.expensetracker;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.expensetracker.auth.PasswordResetCode;
import com.expensetracker.auth.PasswordResetCodeRepository;
import com.expensetracker.auth.ResetCodeMailer;
import com.expensetracker.user.UserRepository;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.ObjectMapper;

/**
 * The code never comes back through the API, so the tests capture it where it is sent - which also
 * keeps them honest about only the hash being stored.
 */
@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
class PasswordResetTest {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper json;

    @Autowired
    private PasswordResetCodeRepository codes;

    @Autowired
    private UserRepository users;

    @Autowired
    private PasswordEncoder encoder;

    @MockitoBean
    private ResetCodeMailer mailer;

    private static final java.util.concurrent.atomic.AtomicInteger CLIENT_IPS =
            new java.util.concurrent.atomic.AtomicInteger();

    private String email;
    /** Each test gets its own client address so the shared rate limiter does not bleed between them. */
    private String clientIp;

    @BeforeEach
    void registerUser() throws Exception {
        String suffix = String.valueOf(System.nanoTime());
        email = "reset" + suffix + "@test.com";
        int slot = CLIENT_IPS.incrementAndGet();
        clientIp = "203.0.%d.%d".formatted(slot / 250, slot % 250 + 1);
        mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("email", email, "username", "reset" + suffix,
                        "password", "original-password"))))
                .andExpect(status().isOk());
    }

    @Test
    void aCodeResetsThePasswordAndCannotBeUsedTwice() throws Exception {
        String code = requestCode(email);

        mvc.perform(reset(email, code, "brand-new-password"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("changed")));

        mvc.perform(login(email, "brand-new-password")).andExpect(status().isOk());
        mvc.perform(login(email, "original-password")).andExpect(status().isUnauthorized());

        // the code is spent
        mvc.perform(reset(email, code, "another-password")).andExpect(status().isBadRequest());
    }

    @Test
    void onlyTheCodeHashIsStored() throws Exception {
        String code = requestCode(email);
        PasswordResetCode stored = latestCode();

        assertThat(stored.getCodeHash()).isNotEqualTo(code).startsWith("$2");
        assertThat(encoder.matches(code, stored.getCodeHash())).isTrue();
    }

    @Test
    void aWrongCodeIsCountedAndEventuallyLocksTheAttempt() throws Exception {
        requestCode(email);

        for (int attempt = 0; attempt < 5; attempt++) {
            mvc.perform(reset(email, "000000", "brand-new-password")).andExpect(status().isBadRequest());
        }
        assertThat(latestCode().getAttempts()).isEqualTo(5);

        // even the right code is refused once the attempt budget is gone
        mvc.perform(reset(email, "000000", "brand-new-password"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("Too many")));
        mvc.perform(login(email, "original-password")).andExpect(status().isOk());
    }

    @Test
    void askingForANewCodeRetiresTheOldOne() throws Exception {
        String first = requestCode(email);
        String second = requestCode(email);

        mvc.perform(reset(email, first, "brand-new-password")).andExpect(status().isBadRequest());
        mvc.perform(reset(email, second, "brand-new-password")).andExpect(status().isOk());
    }

    @Test
    void anUnknownEmailLooksExactlyLikeAKnownOne() throws Exception {
        long before = codes.count();

        mvc.perform(forgot("nobody" + System.nanoTime() + "@test.com"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("If that email")));

        assertThat(codes.count()).isEqualTo(before);
    }

    @Test
    void resettingWithAnUnknownEmailGivesNothingAway() throws Exception {
        mvc.perform(reset("nobody" + System.nanoTime() + "@test.com", "123456", "brand-new-password"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("not valid")));
    }

    @Test
    void repeatedRequestsStopProducingCodes() throws Exception {
        for (int request = 0; request < 3; request++) {
            mvc.perform(forgot(email)).andExpect(status().isOk());
        }
        long afterThree = codes.count();

        mvc.perform(forgot(email)).andExpect(status().isOk());

        assertThat(codes.count()).isEqualTo(afterThree);
    }

    @Test
    void repeatedFailedLoginsFromOneAddressAreThrottled() throws Exception {
        for (int attempt = 0; attempt < 10; attempt++) {
            mvc.perform(login(email, "wrong-password")).andExpect(status().isUnauthorized());
        }

        mvc.perform(login(email, "wrong-password")).andExpect(status().isTooManyRequests());
        // the right password is refused too while the window is open - that is the point
        mvc.perform(login(email, "original-password")).andExpect(status().isTooManyRequests());
    }

    /** Captures the code as it is handed to the mailer - the only place it exists in the clear. */
    private String requestCode(String address) throws Exception {
        Mockito.clearInvocations(mailer);
        mvc.perform(forgot(address)).andExpect(status().isOk());
        ArgumentCaptor<String> code = ArgumentCaptor.forClass(String.class);
        Mockito.verify(mailer).send(Mockito.eq(address), Mockito.anyString(), code.capture(), Mockito.any());
        return code.getValue();
    }

    private PasswordResetCode latestCode() {
        Long userId = users.findByEmailIgnoreCase(email).orElseThrow().getId();
        return codes.findFirstByUserIdOrderByCreatedAtDesc(userId).orElseThrow();
    }

    private org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder forgot(String address)
            throws Exception {
        return post("/api/auth/password/forgot").header("X-Forwarded-For", clientIp)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("email", address)));
    }

    private org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder reset(String address,
            String code, String password) throws Exception {
        return post("/api/auth/password/reset").header("X-Forwarded-For", clientIp)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("email", address, "code", code, "password", password)));
    }

    private org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder login(String address,
            String password) throws Exception {
        return post("/api/auth/login").header("X-Forwarded-For", clientIp)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("identifier", address, "password", password)));
    }
}
