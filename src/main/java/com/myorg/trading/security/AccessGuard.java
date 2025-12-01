package com.myorg.trading.security;

import com.myorg.trading.domain.entity.Order;
import com.myorg.trading.domain.repository.OrderRepository;
import com.myorg.trading.service.user.UserService;
import org.springframework.stereotype.Component;
import org.springframework.security.core.userdetails.UserDetails;

@Component("accessGuard")
public class AccessGuard {

    private final OrderRepository orderRepository;
    private final UserService userService;

    public AccessGuard(OrderRepository orderRepository, UserService userService) {
        this.orderRepository = orderRepository;
        this.userService = userService;
    }

    /**
     * Return true if principal is owner of the order.
     * principal is typically a UserDetails provided by Spring Security.
     */
    public boolean isOrderOwner(Long orderId, Object principal) {
        if (principal == null) return false;
        String username;
        if (principal instanceof UserDetails ud) username = ud.getUsername();
        else username = principal.toString();

        Long userId;
        try {
            userId = userService.getUserIdForUsername(username);
        } catch (Exception e) {
            return false;
        }

        Order order = orderRepository.findById(orderId).orElse(null);
        return order != null && order.getUserId().equals(userId);
    }
}
