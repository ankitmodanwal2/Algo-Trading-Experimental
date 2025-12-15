package com.myorg.trading.service.scheduling;

import com.myorg.trading.service.trading.OrderExecutionService;
import org.quartz.*;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Date;

@Service
public class SchedulerService {

    private final Scheduler scheduler;

    public SchedulerService(Scheduler scheduler) {
        this.scheduler = scheduler;
    }

    /**
     * Schedule a single-run job to execute given orderId at triggerTime.
     * Returns jobKey (name), for later cancellation.
     */
    public String scheduleOrderOnce(Long orderId, Instant triggerTime) throws SchedulerException {
        JobDataMap data = new JobDataMap();
        data.put("orderId", orderId);

        JobDetail job = JobBuilder.newJob(ExecuteOrderJob.class)
                .withIdentity("execOrder-" + orderId, "orders")
                .usingJobData(data)
                .storeDurably()
                .build();

        Trigger trigger = TriggerBuilder.newTrigger()
                .forJob(job)
                .withIdentity("trigger-" + orderId, "orders")
                .startAt(Date.from(triggerTime))
                .withPriority(5)
                .build();

        scheduler.addJob(job, true);
        scheduler.scheduleJob(trigger);
        return job.getKey().getName();
    }

    public boolean cancelJob(String jobName) throws SchedulerException {
        return scheduler.deleteJob(JobKey.jobKey(jobName, "orders"));
    }
}