package dev.tjj.easi.service;

import dev.tjj.easi.entity.ServiceSchedule;
import dev.tjj.easi.repository.ServiceScheduleRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;

/**
 * Sends email reminders to project contacts for pending schedules
 * that are due in 5, 3, or 1 day. Runs daily at 8 AM.
 * Email failures are logged but never propagated.
 */
@Service
public class ScheduleReminderService {

    private static final Logger log = LoggerFactory.getLogger(ScheduleReminderService.class);
    private static final int[] REMINDER_DAYS = {5, 3, 1};

    private final ServiceScheduleRepository serviceScheduleRepository;
    private final EmailService emailService;

    public ScheduleReminderService(ServiceScheduleRepository serviceScheduleRepository,
                                   EmailService emailService) {
        this.serviceScheduleRepository = serviceScheduleRepository;
        this.emailService = emailService;
    }

    /**
     * Runs daily at 8 AM. Checks for pending schedules due in 5, 3, and 1 day
     * and sends a reminder email to each project's contact email.
     */
    @Scheduled(cron = "0 0 8 * * *")
    public void sendReminders() {
        LocalDate today = LocalDate.now();

        for (int days : REMINDER_DAYS) {
            LocalDate targetDate = today.plusDays(days);
            List<ServiceSchedule> schedules = serviceScheduleRepository.findPendingByDate(targetDate);

            for (ServiceSchedule schedule : schedules) {
                String contactEmail = schedule.getProject().getContactEmail();
                String projectName  = schedule.getProject().getName();
                String purpose      = schedule.getPurpose();
                LocalDate date      = schedule.getDate();

                try {
                    emailService.sendScheduleReminder(contactEmail, projectName, purpose, date, days);
                    log.info("Reminder sent to {} for schedule #{} ({} days away).",
                            contactEmail, schedule.getSchedId(), days);
                } catch (Exception e) {
                    log.error("Failed to send reminder to {} for schedule #{}: {}",
                            contactEmail, schedule.getSchedId(), e.getMessage());
                }
            }
        }
    }
}
