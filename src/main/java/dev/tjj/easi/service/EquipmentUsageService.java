package dev.tjj.easi.service;

import dev.tjj.easi.dto.EquipmentUsageRequest;
import dev.tjj.easi.dto.EquipmentUsageResponse;
import dev.tjj.easi.dto.EquipmentUsageUpdateRequest;
import dev.tjj.easi.entity.Equipment;
import dev.tjj.easi.entity.EquipmentUsage;
import dev.tjj.easi.entity.LogSeverity;
import dev.tjj.easi.entity.LogType;
import dev.tjj.easi.entity.ServiceSchedule;
import dev.tjj.easi.repository.EquipmentRepository;
import dev.tjj.easi.repository.EquipmentUsageRepository;
import dev.tjj.easi.repository.ServiceScheduleRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/** Handles logging and retrieval of equipment deployment events. */
@Service
public class EquipmentUsageService {

    private final EquipmentUsageRepository usageRepository;
    private final EquipmentRepository equipmentRepository;
    private final ServiceScheduleRepository scheduleRepository;
    private final LogService logService;

    public EquipmentUsageService(EquipmentUsageRepository usageRepository,
                                 EquipmentRepository equipmentRepository,
                                 ServiceScheduleRepository scheduleRepository,
                                 LogService logService) {
        this.usageRepository = usageRepository;
        this.equipmentRepository = equipmentRepository;
        this.scheduleRepository = scheduleRepository;
        this.logService = logService;
    }

    /**
     * Logs equipment deployment to a schedule.
     * For durables, rejects if the same equipment is already assigned on the same calendar date
     * to prevent double-booking. Uses optimistic locking (@Version) to guard concurrent requests.
     */
    @Transactional
    public EquipmentUsageResponse add(EquipmentUsageRequest request) {
        Equipment equipment = equipmentRepository.findById(request.equipmentId())
                .orElseThrow(() -> new IllegalArgumentException("Equipment not found."));
        ServiceSchedule schedule = scheduleRepository.findById(request.schedId())
                .orElseThrow(() -> new IllegalArgumentException("Service schedule not found."));

        checkDurableConflict(equipment, schedule, null);

        EquipmentUsage usage = new EquipmentUsage();
        usage.setEquipment(equipment);
        usage.setServiceSchedule(schedule);
        usage.setNotes(request.notes());
        usage.setLoggedOn(LocalDateTime.now());

        EquipmentUsage saved = usageRepository.save(usage);
        logService.logByEmail(getEmail(), LogType.AUDIT, LogSeverity.INFO, "CREATE",
                "EquipmentUsage", String.valueOf(saved.getUsageId()),
                "Logged equipment #" + equipment.getEquipmentId() + " (" + equipment.getName()
                        + ") deployed to schedule #" + schedule.getSchedId(), null);

        return toResponse(saved);
    }

    /**
     * Updates the schedule link and notes of an existing usage record.
     * Re-checks durable conflict if the schedule changes.
     */
    @Transactional
    public EquipmentUsageResponse update(Integer usageId, EquipmentUsageUpdateRequest request) {
        EquipmentUsage usage = usageRepository.findById(usageId)
                .orElseThrow(() -> new IllegalArgumentException("Equipment usage record not found."));
        ServiceSchedule schedule = scheduleRepository.findById(request.schedId())
                .orElseThrow(() -> new IllegalArgumentException("Service schedule not found."));

        checkDurableConflict(usage.getEquipment(), schedule, usageId);

        usage.setServiceSchedule(schedule);
        usage.setNotes(request.notes());

        EquipmentUsage saved = usageRepository.save(usage);
        logService.logByEmail(getEmail(), LogType.AUDIT, LogSeverity.INFO, "UPDATE",
                "EquipmentUsage", String.valueOf(usageId),
                "Updated equipment usage record #" + usageId, null);

        return toResponse(saved);
    }

    /** Deletes a usage record by ID. */
    @Transactional
    public void delete(Integer usageId) {
        EquipmentUsage usage = usageRepository.findById(usageId)
                .orElseThrow(() -> new IllegalArgumentException("Equipment usage record not found."));
        usageRepository.delete(usage);
        logService.logByEmail(getEmail(), LogType.AUDIT, LogSeverity.INFO, "DELETE",
                "EquipmentUsage", String.valueOf(usageId),
                "Deleted equipment usage record #" + usageId, null);
    }

    /** Returns a paginated list of usage records for a given equipment ID. */
    public Page<EquipmentUsageResponse> getByEquipment(Integer equipmentId, Pageable pageable) {
        if (!equipmentRepository.existsById(equipmentId)) {
            throw new IllegalArgumentException("Equipment not found.");
        }
        return usageRepository.findByEquipment_EquipmentId(equipmentId, pageable).map(this::toResponse);
    }

    /** Returns a paginated list of usage records for a given schedule ID. */
    public Page<EquipmentUsageResponse> getBySchedule(Integer schedId, Pageable pageable) {
        if (!scheduleRepository.existsById(schedId)) {
            throw new IllegalArgumentException("Service schedule not found.");
        }
        return usageRepository.findByServiceSchedule_SchedId(schedId, pageable).map(this::toResponse);
    }

    /**
     * Throws a 409-signaling IllegalStateException if a durable equipment is already
     * deployed on the same calendar date as the target schedule (excluding the current record
     * when updating). Consumables are exempt from this check.
     */
    private void checkDurableConflict(Equipment equipment, ServiceSchedule schedule, Integer excludeUsageId) {
        if (!"durable".equals(equipment.getType())) return;
        long conflicts = usageRepository.countConflict(
                equipment.getEquipmentId(), schedule.getDate(), excludeUsageId);
        if (conflicts > 0) {
            throw new IllegalStateException(
                    "Equipment #" + equipment.getEquipmentId() + " (" + equipment.getName()
                    + ") is already deployed on " + schedule.getDate() + ".");
        }
    }

    private EquipmentUsageResponse toResponse(EquipmentUsage u) {
        return new EquipmentUsageResponse(
                u.getUsageId(),
                u.getEquipment().getEquipmentId(),
                u.getEquipment().getName(),
                u.getEquipment().getType(),
                u.getServiceSchedule().getSchedId(),
                u.getServiceSchedule().getDate(),
                u.getNotes(),
                u.getLoggedOn()
        );
    }

    private String getEmail() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null ? auth.getName() : null;
    }
}
