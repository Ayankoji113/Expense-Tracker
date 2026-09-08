package com.expensetracker.user;

import jakarta.persistence.*;
import org.hibernate.annotations.Generated;
import org.hibernate.generator.EventType;
import java.time.Instant;

@Entity
@Table(name = "users")
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String email;

    /** Null for Google accounts, which never have a local password. */
    @Column(name = "password_hash")
    private String passwordHash;

    @Column(nullable = false)
    private String username;

    private Integer age;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Provider provider;

    /** Google's stable user id, the thing to match on - an email can change. */
    @Column(name = "google_sub")
    private String googleSub;

    @Column(name = "avatar_url")
    private String avatarUrl;

    // the database sets this, so read it back on insert instead of returning null
    @Generated(event = EventType.INSERT)
    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;

    public enum Provider {
        LOCAL, GOOGLE
    }

    protected User() {
    }

    public static User local(String email, String username, String passwordHash, Integer age) {
        User user = new User();
        user.email = email;
        user.username = username;
        user.passwordHash = passwordHash;
        user.age = age;
        user.provider = Provider.LOCAL;
        return user;
    }

    public static User google(String email, String username, String googleSub, String avatarUrl) {
        User user = new User();
        user.email = email;
        user.username = username;
        user.googleSub = googleSub;
        user.avatarUrl = avatarUrl;
        user.provider = Provider.GOOGLE;
        return user;
    }

    public void updateProfile(String username, Integer age) {
        this.username = username;
        this.age = age;
    }

    /** An account created with a password can also be claimed by the matching Google login. */
    public void linkGoogle(String googleSub, String avatarUrl) {
        this.googleSub = googleSub;
        if (this.avatarUrl == null) {
            this.avatarUrl = avatarUrl;
        }
    }

    public Long getId() {
        return id;
    }

    public String getEmail() {
        return email;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public String getUsername() {
        return username;
    }

    public Integer getAge() {
        return age;
    }

    public Provider getProvider() {
        return provider;
    }

    public String getGoogleSub() {
        return googleSub;
    }

    public String getAvatarUrl() {
        return avatarUrl;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
