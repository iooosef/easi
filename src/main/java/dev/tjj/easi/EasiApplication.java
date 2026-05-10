package dev.tjj.easi;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class EasiApplication {

	public static void main(String[] args) {
		SpringApplication.run(EasiApplication.class, args);
	}

}
