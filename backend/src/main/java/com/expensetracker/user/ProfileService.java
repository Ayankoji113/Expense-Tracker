package com.expensetracker.user;

import com.expensetracker.common.BadRequestException;
import com.expensetracker.common.NotFoundException;
import com.expensetracker.user.ProfileController.ProfileDto;
import com.expensetracker.user.ProfileController.ProfileRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ProfileService {

    private final UserRepository users;

    public ProfileService(UserRepository users) {
        this.users = users;
    }

    @Transactional(readOnly = true)
    public ProfileDto get(Long userId) {
        return toDto(require(userId));
    }

    @Transactional
    public ProfileDto update(Long userId, ProfileRequest request) {
        User user = require(userId);
        String username = Usernames.normalise(request.username());
        if (!username.equalsIgnoreCase(user.getUsername()) && users.existsByUsernameIgnoreCase(username)) {
            throw new BadRequestException("That username is taken");
        }
        user.updateProfile(username, request.age());
        return toDto(users.save(user));
    }

    private User require(Long userId) {
        return users.findById(userId).orElseThrow(() -> new NotFoundException("Profile not found"));
    }

    public static ProfileDto toDto(User user) {
        return new ProfileDto(user.getId(), user.getEmail(), user.getUsername(), user.getAge(),
                user.getProvider().name(), user.getAvatarUrl(), user.getCreatedAt());
    }
}
