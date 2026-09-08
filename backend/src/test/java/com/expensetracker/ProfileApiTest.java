package com.expensetracker;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.ObjectMapper;

@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
class ProfileApiTest {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper json;

    @Test
    void registrationStoresTheProfileAndReturnsItWithTheToken() throws Exception {
        String suffix = String.valueOf(System.nanoTime());
        mvc.perform(register("ada" + suffix + "@test.com", "ada" + suffix, 29))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isNotEmpty())
                .andExpect(jsonPath("$.user.username").value("ada" + suffix))
                .andExpect(jsonPath("$.user.age").value(29))
                .andExpect(jsonPath("$.user.provider").value("LOCAL"));
    }

    @Test
    void usernamesAreUniqueAndValidated() throws Exception {
        String username = "grace" + System.nanoTime();
        mvc.perform(register(username + "@test.com", username, 31)).andExpect(status().isOk());

        mvc.perform(register("someone" + System.nanoTime() + "@test.com", username, 31))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("That username is taken"));

        mvc.perform(register("bad" + System.nanoTime() + "@test.com", "no spaces allowed", 31))
                .andExpect(status().isBadRequest());
    }

    @Test
    void ageMustBeSensibleWhenGiven() throws Exception {
        mvc.perform(register("kid" + System.nanoTime() + "@test.com", "kid" + System.nanoTime(), 7))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("13")));
    }

    @Test
    void aUserCanReadAndUpdateTheirOwnProfileOnly() throws Exception {
        String suffix = String.valueOf(System.nanoTime());
        String token = tokenOf(register("lin" + suffix + "@test.com", "lin" + suffix, null));

        mvc.perform(get("/api/profile").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("lin" + suffix))
                .andExpect(jsonPath("$.age").doesNotExist());

        mvc.perform(put("/api/profile").header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("username", "lin.renamed" + suffix, "age", 34))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("lin.renamed" + suffix))
                .andExpect(jsonPath("$.age").value(34));

        mvc.perform(get("/api/profile")).andExpect(status().isUnauthorized());
    }

    @Test
    void signInWorksWithEitherTheUsernameOrTheEmail() throws Exception {
        String suffix = String.valueOf(System.nanoTime());
        String email = "dual" + suffix + "@test.com";
        String username = "dual" + suffix;
        mvc.perform(register(email, username, 30)).andExpect(status().isOk());

        mvc.perform(login(username)).andExpect(status().isOk()).andExpect(jsonPath("$.user.email").value(email));
        mvc.perform(login(username.toUpperCase())).andExpect(status().isOk());
        mvc.perform(login(email)).andExpect(status().isOk());
        mvc.perform(login("nobody" + suffix)).andExpect(status().isUnauthorized());
    }

    private org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder login(String identifier)
            throws Exception {
        return post("/api/auth/login").header("X-Forwarded-For", "198.51.100." + (System.nanoTime() % 250 + 1))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("identifier", identifier, "password", "password123")));
    }

    @Test
    void googleSignInIsRejectedCleanlyWhenTheServerHasNoClientId() throws Exception {
        mvc.perform(post("/api/auth/google").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("credential", "not-a-real-token"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("GOOGLE_CLIENT_ID")));

        mvc.perform(get("/api/auth/config"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.googleEnabled").value(false));
    }

    private org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder register(String email,
            String username, Integer age) throws Exception {
        Map<String, Object> body = new HashMap<>();
        body.put("email", email);
        body.put("username", username);
        body.put("password", "password123");
        body.put("age", age);
        return post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body));
    }

    private String tokenOf(org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder request)
            throws Exception {
        String body = mvc.perform(request).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return json.readTree(body).get("token").asText();
    }
}
