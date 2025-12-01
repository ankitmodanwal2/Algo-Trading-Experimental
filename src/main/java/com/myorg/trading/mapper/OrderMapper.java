package com.myorg.trading.mapper;

import com.myorg.trading.controller.dto.PlaceOrderRequest;
import com.myorg.trading.domain.entity.Order;
import com.myorg.trading.domain.entity.OrderStatus;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;

/**
 * Simple manual mapper to avoid MapStruct compile-time issues while you stabilise entity fields.
 * It maps only the fields we expect from PlaceOrderRequest -> Order.
 */
@Component
public class OrderMapper {

    public Order toOrder(PlaceOrderRequest req, Long userId) {
        if (req == null) return null;
        Order order = new Order();

        // fields that your controller/service expect
        order.setUserId(userId);
        order.setBrokerAccountId(req.getBrokerAccountId());
        order.setSymbol(req.getSymbol());
        order.setSide(req.getSide() != null ? req.getSide().name() : null);

        // quantity & price conversions - adapt if your Order.quantity has other type
        if (req.getQuantity() != null) {
            order.setQuantity(new BigDecimal(req.getQuantity().toString()));
        } else {
            order.setQuantity(BigDecimal.ZERO);
        }
        if (req.getPrice() != null) {
            order.setPrice(new BigDecimal(req.getPrice().toString()));
        } else {
            order.setPrice(BigDecimal.ZERO);
        }

        order.setOrderType(req.getOrderType() != null ? req.getOrderType().name() : null);

        // DB-managed fields (id, createdAt, etc.) left null
        order.setStatus(OrderStatus.PENDING);

        return order;
    }
}
