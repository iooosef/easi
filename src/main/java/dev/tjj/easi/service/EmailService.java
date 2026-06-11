package dev.tjj.easi.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

/** Handles sending transactional emails such as schedule reminders. */
@Service
public class EmailService {

    private final JavaMailSender mailSender;

    @Value("${spring.mail.username}")
    private String fromEmail;

    public EmailService(JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }

    /** Sends a pending schedule reminder to the project contact. */
    public void sendScheduleReminder(String toEmail, String projectName, String purpose, LocalDate date, int daysUntil) {
        String formattedDate = date.format(DateTimeFormatter.ofPattern("MMMM d, yyyy"));
        String dayWord = daysUntil == 1 ? "tomorrow" : "in " + daysUntil + " days";

        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(fromEmail);
        message.setTo(toEmail);
        message.setSubject("EASI – Upcoming Service Schedule Reminder: " + purpose);
        message.setText(
                "Dear " + projectName + " Team,\n\n" +
                "We would like to remind you that a service visit has been scheduled for your property.\n\n" +
                "  Purpose : " + purpose + "\n" +
                "  Date    : " + formattedDate + " (" + dayWord + ")\n\n" +
                "Please ensure that the site is accessible and prepared for our team on the scheduled date. " +
                "If you need to reschedule or have any questions, please don't hesitate to reach out to us " +
                "at your earliest convenience.\n\n" +
                "Thank you for your continued trust in EASI.\n\n" +
                "Best regards,\n" +
                "EASI Service Team"
        );
        mailSender.send(message);
    }

}
