package dev.tjj.easi.service;

import dev.tjj.easi.entity.LogSeverity;
import dev.tjj.easi.entity.LogType;
import dev.tjj.easi.entity.Project;
import dev.tjj.easi.entity.ServiceSchedule;
import dev.tjj.easi.repository.ProjectRepository;
import dev.tjj.easi.repository.ServiceScheduleRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Background service that auto-generates a pending service schedule for every
 * active project that has no upcoming schedule and no schedule within the past 3 months.
 * Runs daily at midnight.
 */
@Service
public class ScheduleAutoGeneratorService {

    private static final Logger log = LoggerFactory.getLogger(ScheduleAutoGeneratorService.class);
    private static final String AUTO_PURPOSE = "Checkup/Preventative Maintenance";

    private final ProjectRepository projectRepository;
    private final ServiceScheduleRepository serviceScheduleRepository;
    private final LogService logService;

    public ScheduleAutoGeneratorService(ProjectRepository projectRepository,
                                        ServiceScheduleRepository serviceScheduleRepository,
                                        LogService logService) {
        this.projectRepository = projectRepository;
        this.serviceScheduleRepository = serviceScheduleRepository;
        this.logService = logService;
    }

    /**
     * Runs daily at midnight. For each active project with no upcoming schedule
     * and no schedule in the past 3 months, creates a pending schedule dated 1 week from today.
     */
    @Scheduled(cron = "0 0 0 * * *")
    @Transactional
    public void generateMissingSchedules() {
        LocalDate today = LocalDate.now();
        LocalDate cutoff = today.minusMonths(3);
        LocalDate scheduledDate = today.plusWeeks(1);

        List<Project> projects = projectRepository.findActiveWithoutRecentOrUpcomingSchedule(cutoff);

        if (projects.isEmpty()) {
            log.info("Auto-schedule check: all active projects have a recent schedule.");
            return;
        }

        for (Project project : projects) {
            ServiceSchedule schedule = new ServiceSchedule();
            schedule.setProject(project);
            schedule.setPurpose(AUTO_PURPOSE);
            schedule.setDate(scheduledDate);
            schedule.setStatus("pending");
            schedule.setAddedOn(LocalDateTime.now());

            ServiceSchedule saved = serviceScheduleRepository.save(schedule);

            logService.logByEmail(
                    "system",
                    LogType.AUDIT,
                    LogSeverity.INFO,
                    "CREATE",
                    "ServiceSchedule",
                    String.valueOf(saved.getSchedId()),
                    "Auto-generated schedule #" + saved.getSchedId() + " for project #" + project.getProjNum(),
                    null
            );

            log.info("Auto-generated schedule #{} for project #{} ({})",
                    saved.getSchedId(), project.getProjNum(), project.getName());
        }

        log.info("Auto-schedule check: generated {} schedule(s).", projects.size());
    }
}
