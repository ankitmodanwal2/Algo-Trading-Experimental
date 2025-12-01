//package com.myorg.trading.config;
//
//import org.springframework.context.annotation.Bean;
//import org.springframework.context.annotation.Configuration;
//import org.springframework.scheduling.quartz.SchedulerFactoryBean;
//
//import javax.sql.DataSource;
//import java.util.Properties;
//
//@Configuration
//public class QuartzConfig {
//
//    @Bean
//    public SchedulerFactoryBean schedulerFactoryBean(DataSource dataSource) {
//
//        Properties quartzProps = new Properties();
//        quartzProps.setProperty("org.quartz.scheduler.instanceName", "TradingQuartzScheduler");
//        quartzProps.setProperty("org.quartz.scheduler.instanceId", "AUTO");
//
//        // DB Job Store
//        quartzProps.setProperty("org.quartz.jobStore.class",
//                "org.quartz.impl.jdbcjobstore.JobStoreTX");
//
//        quartzProps.setProperty("org.quartz.jobStore.driverDelegateClass",
//                "org.quartz.impl.jdbcjobstore.StdJDBCDelegate");
//
//        quartzProps.setProperty("org.quartz.jobStore.tablePrefix", "QRTZ_");
//        quartzProps.setProperty("org.quartz.jobStore.isClustered", "true");
//        quartzProps.setProperty("org.quartz.jobStore.clusterCheckinInterval", "5000");
//
//        // Thread Pool
//        quartzProps.setProperty("org.quartz.threadPool.threadCount", "10");
//        quartzProps.setProperty("org.quartz.threadPool.threadPriority", "5");
//
//        SchedulerFactoryBean factory = new SchedulerFactoryBean();
//        factory.setDataSource(dataSource);
//        factory.setQuartzProperties(quartzProps);
//        factory.setOverwriteExistingJobs(true);
//        factory.setWaitForJobsToCompleteOnShutdown(false);
//
//        return factory;
//    }
//}
//package com.myorg.trading.config;
//
//import org.springframework.context.annotation.Bean;
//import org.springframework.context.annotation.Configuration;
//import org.springframework.scheduling.quartz.SchedulerFactoryBean;
//
//import javax.sql.DataSource;
//import java.util.Properties;
//
//@Configuration
//public class QuartzConfig {
//
//    @Bean
//    public SchedulerFactoryBean schedulerFactoryBean(DataSource dataSource) {
//
//        Properties quartzProps = new Properties();
//        quartzProps.setProperty("org.quartz.scheduler.instanceName", "TradingQuartzScheduler");
//        quartzProps.setProperty("org.quartz.scheduler.instanceId", "AUTO");
//
//        // DB Job Store (JDBC)
//        quartzProps.setProperty("org.quartz.jobStore.class", "org.quartz.impl.jdbcjobstore.JobStoreTX");
//        quartzProps.setProperty("org.quartz.jobStore.driverDelegateClass", "org.quartz.impl.jdbcjobstore.StdJDBCDelegate");
//        quartzProps.setProperty("org.quartz.jobStore.tablePrefix", "QRTZ_");
//        quartzProps.setProperty("org.quartz.jobStore.isClustered", "true");
//        quartzProps.setProperty("org.quartz.jobStore.clusterCheckinInterval", "5000");
//
//        // *** IMPORTANT: give Quartz the logical name for the DataSource ***
//        // This name is the key Quartz uses internally to look up the DataSource.
//        quartzProps.setProperty("org.quartz.jobStore.dataSource", "default");
//
//        // configure a minimal data-source config (unused when Spring injects DataSource,
//        // but some Quartz versions expect provider to be present)
//        quartzProps.setProperty("org.quartz.dataSource.quartzDataSource.provider", "spring");
//        // Optionally set max connections Quartz will ask for; not required when using spring DataSource,
//        // but can be set for clarity:
//        quartzProps.setProperty("org.quartz.dataSource.quartzDataSource.maxConnections", "10");
//
//        // Thread Pool
//        quartzProps.setProperty("org.quartz.threadPool.threadCount", "10");
//        quartzProps.setProperty("org.quartz.threadPool.threadPriority", "5");
//
//        SchedulerFactoryBean factory = new SchedulerFactoryBean();
//        // inject the Spring-managed DataSource (will be used by Quartz under the name above)
//        factory.setDataSource(dataSource);
//        factory.setQuartzProperties(quartzProps);
//        factory.setOverwriteExistingJobs(true);
//        factory.setWaitForJobsToCompleteOnShutdown(false);
//
//        return factory;
//    }
//}
package com.myorg.trading.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.quartz.SchedulerFactoryBean;

import javax.sql.DataSource;
import java.util.Properties;

@Configuration
public class QuartzConfig {

    @Bean
    public SchedulerFactoryBean schedulerFactoryBean(DataSource dataSource) {

        Properties quartzProps = new Properties();
        quartzProps.setProperty("org.quartz.scheduler.instanceName", "TradingQuartzScheduler");
        quartzProps.setProperty("org.quartz.scheduler.instanceId", "AUTO");

        // DB Job Store (JDBC)
        quartzProps.setProperty("org.quartz.jobStore.class", "org.quartz.impl.jdbcjobstore.JobStoreTX");
        quartzProps.setProperty("org.quartz.jobStore.driverDelegateClass", "org.quartz.impl.jdbcjobstore.StdJDBCDelegate");
        quartzProps.setProperty("org.quartz.jobStore.tablePrefix", "QRTZ_");
        quartzProps.setProperty("org.quartz.jobStore.isClustered", "true");
        quartzProps.setProperty("org.quartz.jobStore.clusterCheckinInterval", "5000");

        // IMPORTANT: tell Quartz to use the primary Spring DataSource under the logical name "default"
        quartzProps.setProperty("org.quartz.jobStore.dataSource", "default");

        // When Spring injects the DataSource, Quartz expects provider = spring for that logical datasource
        quartzProps.setProperty("org.quartz.dataSource.default.provider", "spring");
        quartzProps.setProperty("org.quartz.dataSource.default.maxConnections", "10");

        // Thread Pool
        quartzProps.setProperty("org.quartz.threadPool.threadCount", "10");
        quartzProps.setProperty("org.quartz.threadPool.threadPriority", "5");

        SchedulerFactoryBean factory = new SchedulerFactoryBean();
        // inject the Spring-managed DataSource (this will be used by Quartz because provider=spring)
        factory.setDataSource(dataSource);
        factory.setQuartzProperties(quartzProps);
        factory.setOverwriteExistingJobs(true);
        factory.setWaitForJobsToCompleteOnShutdown(false);

        return factory;
    }
}
