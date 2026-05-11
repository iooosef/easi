package dev.tjj.easi.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

/** Handles sending transactional emails such as OTP codes. */
@Service
public class EmailService {

    private final JavaMailSender mailSender;

    @Value("${spring.mail.username}")
    private String fromEmail;

    public EmailService(JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }

    /** Sends a one-time password code to the given address for the specified purpose. */
    public void sendOtp(String toEmail, String otp, String purpose) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(fromEmail);
        message.setTo(toEmail);
        message.setSubject("EASI - Your verification code");
        message.setText(
                "Your " + purpose + " code is: " + otp +
                "\n\nThis code expires in 10 minutes. Do not share it with anyone."
        );
        mailSender.send(message);
    }
}
