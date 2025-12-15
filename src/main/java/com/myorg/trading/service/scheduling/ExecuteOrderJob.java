package com.myorg.trading.service.scheduling;

import com.myorg.trading.service.trading.OrderExecutionService;
import com.myorg.trading.service.SpringContext;
import org.quartz.Job;
import org.quartz.JobExecutionContext;
import org.quartz.JobExecutionException;

/**
 * Quartz Job that fetches OrderExecutionService from SpringContext and invokes execution.
 */
public class ExecuteOrderJob implements Job {

    public static final String ORDER_ID_KEY = "orderId";

    @Override
    public void execute(JobExecutionContext context) throws JobExecutionException {
        Long orderId = context.getMergedJobDataMap().getLong(ORDER_ID_KEY);
        OrderExecutionService executor = SpringContext.getBean(OrderExecutionService.class);
        try {
            executor.executeOrder(orderId);
        } catch (Exception e) {
            throw new JobExecutionException(e);
        }
    }
}