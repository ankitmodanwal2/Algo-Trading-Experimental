package com.myorg.trading.controller.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class PlaceOrderResponse {
    private Long orderId;
    private String status;
}
