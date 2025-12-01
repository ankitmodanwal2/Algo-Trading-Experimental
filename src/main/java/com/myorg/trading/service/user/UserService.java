package com.myorg.trading.service.user;

import com.myorg.trading.domain.entity.User;
import com.myorg.trading.domain.repository.UserRepository;
import org.springframework.stereotype.Service;

import java.util.Optional;

/**
 * Service to load users and resolve username -> userId mapping.
 */
@Service
public class UserService {

    private final UserRepository userRepository;

    public UserService(UserRepository repo) {
        this.userRepository = repo;
    }

    /**
     * Load user by username.
     */
    public Optional<User> findByUsername(String username) {
        return userRepository.findByUsername(username);
    }

    /**
     * Resolve username -> userId or throw.
     */
    public Long getUserIdForUsername(String username) {
        return userRepository.findByUsername(username)
                .map(User::getId)
                .orElseThrow(() ->
                        new IllegalArgumentException("Unknown user: " + username)
                );
    }

    /**
     * Get entire User entity by username or throw.
     */
    public User getUserEntity(String username) {
        return userRepository.findByUsername(username)
                .orElseThrow(() ->
                        new IllegalArgumentException("Unknown user: " + username)
                );
    }
}
