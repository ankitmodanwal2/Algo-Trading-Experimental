package com.myorg.trading.service.trading;

import com.myorg.trading.domain.entity.Order;
import com.myorg.trading.domain.entity.ScheduledOrder;
import com.myorg.trading.domain.repository.OrderRepository;
import com.myorg.trading.domain.repository.ScheduledOrderRepository;
import com.myorg.trading.service.scheduling.SchedulerService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@Service
public class OrderService {

    private final OrderRepository orderRepository;
    private final ScheduledOrderRepository scheduledOrderRepository;
    private final OrderExecutionService executionService;
    private final SchedulerService schedulerService;

    public OrderService(OrderRepository orderRepository,
                        ScheduledOrderRepository scheduledOrderRepository,
                        OrderExecutionService executionService,
                        SchedulerService schedulerService) {
        this.orderRepository = orderRepository;
        this.scheduledOrderRepository = scheduledOrderRepository;
        this.executionService = executionService;
        this.schedulerService = schedulerService;
    }

    public Order createOrder(Order order) {
        order.setStatus(com.myorg.trading.domain.entity.OrderStatus.PENDING);
        return orderRepository.save(order);
    }

    public List<Order> getOrdersForUser(Long userId) {
        return orderRepository.findByUserId(userId);
    }

    @Transactional
    public Order placeOrderNow(Long orderId, String tradingSymbol, Map<String, Object> meta) {
        Order order = orderRepository.findById(orderId).orElseThrow();
        executionService.executeOrderAsync(order.getId(), tradingSymbol, meta);
        return order;
    }

    @Transactional
    public ScheduledOrder scheduleOrder(Long orderId, Instant triggerTime) throws org.quartz.SchedulerException {
        ScheduledOrder so = ScheduledOrder.builder()
                .orderId(orderId)
                .triggerTime(triggerTime)
                .active(true)
                .build();
        ScheduledOrder saved = scheduledOrderRepository.save(so);

        String jobKey = schedulerService.scheduleOrderOnce(orderId, triggerTime);
        saved.setQuartzJobKey(jobKey);
        return scheduledOrderRepository.save(saved);
    }
}