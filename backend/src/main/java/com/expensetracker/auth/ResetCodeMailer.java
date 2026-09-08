package com.expensetracker.auth;

import java.time.Duration;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;

/**
 * Sends the reset code by email when SMTP is configured. Without it the code is logged instead, so
 * the flow still works on a laptop - it is never returned through the API.
 */
@Component
public class ResetCodeMailer {

    private static final Logger log = LoggerFactory.getLogger(ResetCodeMailer.class);

    private final ObjectProvider<JavaMailSender> mailSender;
    private final String mailHost;
    private final String from;

    public ResetCodeMailer(ObjectProvider<JavaMailSender> mailSender,
            @Value("${spring.mail.host:}") String mailHost,
            @Value("${app.mail.from:no-reply@expense-tracker.local}") String from) {
        this.mailSender = mailSender;
        this.mailHost = mailHost;
        this.from = from;
    }

    public boolean isEmailConfigured() {
        return !mailHost.isBlank() && mailSender.getIfAvailable() != null;
    }

    public void send(String email, String username, String code, Duration ttl) {
        if (!isEmailConfigured()) {
            log.warn("""
                    No SMTP configured (spring.mail.host is empty), so the password reset code for {} \
                    is only in this log: {} (valid for {} minutes)""", email, code, ttl.toMinutes());
            return;
        }
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(from);
        message.setTo(email);
        message.setSubject("Your Expense Tracker password reset code");
        message.setText("""
                Hi %s,

                Your password reset code is %s

                It expires in %d minutes and can be used once. If you did not ask to reset your
                password you can ignore this email - nothing has changed.
                """.formatted(username, code, ttl.toMinutes()));
        try {
            mailSender.getObject().send(message);
        } catch (RuntimeException e) {
            // never surface the mail server's complaint to the caller
            log.error("Could not send the password reset email to {}", email, e);
        }
    }
}
