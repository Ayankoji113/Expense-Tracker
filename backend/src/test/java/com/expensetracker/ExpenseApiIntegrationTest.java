package com.expensetracker;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;

/** Register -> log in -> create -> import CSV -> report, against a real Postgres. */
@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
class ExpenseApiIntegrationTest {

    private static final String CSV = """
            Date,Description,Amount,Balance
            2026-08-01,WHOLE FOODS MKT 1042,86.24,1420.11
            2026-08-03,STARBUCKS STORE 227,6.75,1398.46
            2026-13-45,BROKEN DATE ROW,10.00,0
            2026-08-05,RENT AUGUST,1200.00,198.46
            """;

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper json;

    private String alice;
    private String bob;

    @BeforeEach
    void registerUsers() throws Exception {
        alice = register("alice" + System.nanoTime() + "@test.com");
        bob = register("bob" + System.nanoTime() + "@test.com");
    }

    @Test
    void rejectsAnonymousAndBadlyAuthenticatedRequests() throws Exception {
        mvc.perform(get("/api/expenses")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/expenses").header("Authorization", "Bearer nonsense"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void validatesTheExpensePayload() throws Exception {
        mvc.perform(post("/api/expenses").header("Authorization", "Bearer " + alice)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"amount": -5, "spentOn": "2026-08-01", "description": ""}"""))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("amount")));
    }

    @Test
    void oneUserCannotSeeOrDeleteAnotherUsersExpense() throws Exception {
        long expenseId = createExpense(alice, "42.50", "2026-08-01", "Whole Foods run");

        mvc.perform(get("/api/expenses/" + expenseId).header("Authorization", "Bearer " + alice))
                .andExpect(status().isOk());
        mvc.perform(get("/api/expenses/" + expenseId).header("Authorization", "Bearer " + bob))
                .andExpect(status().isNotFound());
        mvc.perform(delete("/api/expenses/" + expenseId).header("Authorization", "Bearer " + bob))
                .andExpect(status().isNotFound());

        // Bob's own list stays empty even though Alice has data
        mvc.perform(get("/api/expenses").header("Authorization", "Bearer " + bob))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(0));
    }

    @Test
    void importsValidRowsCategorisesThemAndReportsTheBrokenOnes() throws Exception {
        long groceries = categoryId(alice, "Groceries");
        createRule(alice, "whole foods", groceries);

        JsonNode summary = importCsv(alice, CSV);
        assertThat(summary.get("imported").asInt()).isEqualTo(3);
        assertThat(summary.get("duplicates").asInt()).isZero();
        assertThat(summary.get("failed").asInt()).isEqualTo(1);
        assertThat(summary.get("rowErrors").get(0).get("row").asInt()).isEqualTo(4);
        assertThat(summary.get("ignoredColumns").get(0).asText()).isEqualTo("Balance");

        // the rule applied, and the untouched rows fell back to Uncategorized
        mvc.perform(get("/api/expenses").param("q", "whole foods").header("Authorization", "Bearer " + alice))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].categoryName").value("Groceries"));

        // re-importing the same file changes nothing
        JsonNode second = importCsv(alice, CSV);
        assertThat(second.get("imported").asInt()).isZero();
        assertThat(second.get("duplicates").asInt()).isEqualTo(3);
    }

    @Test
    void reportsAddUpAndStayScopedToTheUser() throws Exception {
        importCsv(alice, CSV);
        createExpense(bob, "500.00", "2026-08-02", "Bobs rent");

        mvc.perform(get("/api/reports/summary").header("Authorization", "Bearer " + alice))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.transactionCount").value(3))
                .andExpect(jsonPath("$.expense").value(1292.99));

        mvc.perform(get("/api/reports/summary").header("Authorization", "Bearer " + bob))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.expense").value(500.00));

        mvc.perform(get("/api/reports/by-category").header("Authorization", "Bearer " + alice))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].percentage").exists());
    }

    @Test
    void incomeIsTrackedSeparatelyAndDrivesTheSavingsRate() throws Exception {
        createTransaction(alice, "100000.00", "2026-08-01", "August salary", "INCOME");
        createTransaction(alice, "25000.00", "2026-08-05", "Rent", "EXPENSE");

        mvc.perform(get("/api/reports/summary").param("from", "2026-08-01").param("to", "2026-08-31")
                .header("Authorization", "Bearer " + alice))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.income").value(100000.00))
                .andExpect(jsonPath("$.expense").value(25000.00))
                .andExpect(jsonPath("$.balance").value(75000.00))
                .andExpect(jsonPath("$.savingsRate").value(75.0));

        // income must not pollute the expense-by-category breakdown
        mvc.perform(get("/api/reports/by-category").header("Authorization", "Bearer " + alice))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.category == 'Uncategorized')].total").value(org.hamcrest.Matchers
                        .contains(25000.00)));

        mvc.perform(get("/api/expenses").param("kind", "INCOME").header("Authorization", "Bearer " + alice))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].kind").value("INCOME"));
    }

    @Test
    void budgetsReportSpendingAgainstTheirLimitAndStayPrivate() throws Exception {
        long groceries = categoryId(alice, "Groceries");
        String month = java.time.YearMonth.now().toString();
        createCategorisedExpense(alice, "4250.00", java.time.LocalDate.now().withDayOfMonth(1).toString(),
                "Groceries run", groceries);

        String body = mvc.perform(post("/api/budgets").header("Authorization", "Bearer " + alice)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(
                        java.util.Map.of("categoryId", groceries, "monthlyLimit", "6000.00"))))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        long budgetId = json.readTree(body).get("id").asLong();

        mvc.perform(get("/api/budgets").param("month", month).header("Authorization", "Bearer " + alice))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].spent").value(4250.00))
                .andExpect(jsonPath("$[0].remaining").value(1750.00))
                .andExpect(jsonPath("$[0].usedPercent").value(70.8));

        // a second budget for the same category is rejected, and Bob sees none of this
        mvc.perform(post("/api/budgets").header("Authorization", "Bearer " + alice)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(
                        java.util.Map.of("categoryId", groceries, "monthlyLimit", "9000.00"))))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/api/budgets").header("Authorization", "Bearer " + bob))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
        mvc.perform(delete("/api/budgets/" + budgetId).header("Authorization", "Bearer " + bob))
                .andExpect(status().isNotFound());
    }

    private String register(String email) throws Exception {
        String body = mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(java.util.Map.of("email", email, "password", "password123",
                        "username", email.split("@")[0].replace("-", "")))))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return json.readTree(body).get("token").asText();
    }

    private long createExpense(String token, String amount, String date, String description) throws Exception {
        String body = mvc.perform(post("/api/expenses").header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(
                        java.util.Map.of("amount", amount, "spentOn", date, "description", description))))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return json.readTree(body).get("id").asLong();
    }

    private void createTransaction(String token, String amount, String date, String description, String kind)
            throws Exception {
        mvc.perform(post("/api/expenses").header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(java.util.Map.of("amount", amount, "spentOn", date,
                        "description", description, "kind", kind))))
                .andExpect(status().isCreated());
    }

    private void createCategorisedExpense(String token, String amount, String date, String description,
            long categoryId) throws Exception {
        mvc.perform(post("/api/expenses").header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(java.util.Map.of("amount", amount, "spentOn", date,
                        "description", description, "categoryId", categoryId))))
                .andExpect(status().isCreated());
    }

    private long categoryId(String token, String name) throws Exception {
        String body = mvc.perform(get("/api/categories").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        for (JsonNode category : json.readTree(body)) {
            if (category.get("name").asText().equals(name)) {
                return category.get("id").asLong();
            }
        }
        throw new AssertionError("no category named " + name);
    }

    private void createRule(String token, String keyword, long categoryId) throws Exception {
        mvc.perform(post("/api/categories/rules").header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(java.util.Map.of("keyword", keyword, "categoryId", categoryId))))
                .andExpect(status().isCreated());
    }

    private JsonNode importCsv(String token, String csv) throws Exception {
        var file = new MockMultipartFile("file", "transactions.csv", "text/csv", csv.getBytes(StandardCharsets.UTF_8));
        String body = mvc.perform(multipart("/api/expenses/import").file(file)
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return json.readTree(body);
    }
}
