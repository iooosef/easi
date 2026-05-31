package dev.tjj.easi.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "payment_logs")
public class PaymentLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "log_id")
    @Getter @Setter
    private Integer logId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sr_number", nullable = false)
    @Getter @Setter
    private ServiceReport serviceReport;

    @Column(name = "amount", nullable = false, precision = 19, scale = 2)
    @Getter @Setter
    private BigDecimal amount;

    @Column(name = "payment_method", length = 16, nullable = false)
    @Getter @Setter
    private String paymentMethod;

    @Column(name = "receipt_date", nullable = false)
    @Getter @Setter
    private LocalDate receiptDate;

    @Column(name = "receipt_number", length = 60)
    @Getter @Setter
    private String receiptNumber;

    /** Name of the person or organization that made the payment. */
    @Column(name = "paid_by", length = 120, nullable = false)
    @Getter @Setter
    private String paidBy;

    @Column(name = "notes", length = 255)
    @Getter @Setter
    private String notes;

    @Column(name = "added_on", nullable = false)
    @Getter @Setter
    private LocalDateTime addedOn;
}
