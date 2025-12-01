package com.myorg.trading.security;

import com.myorg.trading.security.dto.LoginRequest;
import com.myorg.trading.security.dto.LoginResponse;
import com.myorg.trading.security.dto.RegisterRequest;

import com.myorg.trading.domain.entity.User;
import com.myorg.trading.domain.repository.UserRepository;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.*;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final AuthenticationManager authenticationManager;
    private final JwtUtil jwtUtil;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public AuthController(AuthenticationManager authenticationManager,
                          JwtUtil jwtUtil,
                          UserRepository userRepository,
                          PasswordEncoder passwordEncoder) {
        this.authenticationManager = authenticationManager;
        this.jwtUtil = jwtUtil;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody @Valid LoginRequest request) {
        try {
            Authentication auth = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(request.getUsername(), request.getPassword())
            );

            String token = jwtUtil.generateToken(request.getUsername(), Map.of("role", "ROLE_USER"));
            return ResponseEntity.ok(new LoginResponse(token));
        } catch (BadCredentialsException ex) {
            return ResponseEntity.status(401).body(Map.of("error", "Invalid username/password"));
        }
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody @Valid RegisterRequest r) {
        if (userRepository.findByUsername(r.getUsername()).isPresent()) {
            return ResponseEntity.badRequest().body(Map.of("error", "username_taken"));
        }
        User u = User.builder()
                .username(r.getUsername())
                .passwordHash(passwordEncoder.encode(r.getPassword()))
                .role("ROLE_USER")
                .build();
        userRepository.save(u);
        String token = jwtUtil.generateToken(u.getUsername(), Map.of("role", u.getRole()));
        return ResponseEntity.ok(new LoginResponse(token));
    }
}
