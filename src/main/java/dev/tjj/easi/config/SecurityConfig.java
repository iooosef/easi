package dev.tjj.easi.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import dev.tjj.easi.security.JwtAuthenticationFilter;

import java.util.List;
import org.springframework.http.HttpMethod;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final UserDetailsService userDetailsService;

    public SecurityConfig(JwtAuthenticationFilter jwtAuthenticationFilter, UserDetailsService userDetailsService) {
        this.jwtAuthenticationFilter = jwtAuthenticationFilter;
        this.userDetailsService = userDetailsService;
    }

    /** Configures route-level access rules; employee endpoints are ADMIN/HR-only except GET /me. */
    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .csrf(csrf -> csrf.disable())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/api/auth/**").permitAll()
                        .requestMatchers("/test").permitAll()
                        .requestMatchers("/api/users/forgot-password", "/api/users/reset-password").permitAll()
                        .requestMatchers("/api/users/admin-reset-password").hasAnyRole("ADMIN", "HR")
                        .requestMatchers("/api/users/register").hasAnyRole("ADMIN", "HR")
                        .requestMatchers(HttpMethod.GET, "/api/employees/me").authenticated()
                        .requestMatchers("/api/employees").hasAnyRole("ADMIN", "HR")
                        .requestMatchers("/api/employees/**").hasAnyRole("ADMIN", "HR")
                        .requestMatchers(HttpMethod.POST, "/api/projects").hasAnyRole("ADMIN", "STAFF")
                        .requestMatchers(HttpMethod.PUT, "/api/projects/**").hasAnyRole("ADMIN", "STAFF")
                        .requestMatchers(HttpMethod.GET, "/api/projects", "/api/projects/**").authenticated()
                        .requestMatchers(HttpMethod.POST, "/api/vehicles").hasAnyRole("ADMIN", "STAFF")
                        .requestMatchers(HttpMethod.PUT, "/api/vehicles/**").hasAnyRole("ADMIN", "STAFF")
                        .requestMatchers(HttpMethod.GET, "/api/vehicles", "/api/vehicles/**").hasAnyRole("ADMIN", "STAFF", "CREW")
                        .requestMatchers(HttpMethod.POST, "/api/suppliers").hasAnyRole("ADMIN", "ACCOUNTING", "STAFF")
                        .requestMatchers(HttpMethod.PUT, "/api/suppliers/**").hasAnyRole("ADMIN", "ACCOUNTING", "STAFF")
                        .requestMatchers(HttpMethod.GET, "/api/suppliers", "/api/suppliers/**").hasAnyRole("ADMIN", "ACCOUNTING", "STAFF")
                        .requestMatchers(HttpMethod.POST, "/api/service-schedules").hasAnyRole("ADMIN", "STAFF")
                        .requestMatchers(HttpMethod.PUT, "/api/service-schedules/**").hasAnyRole("ADMIN", "STAFF")
                        .requestMatchers(HttpMethod.GET, "/api/service-schedules", "/api/service-schedules/**").authenticated()
                        .requestMatchers(HttpMethod.POST, "/api/ac-units").hasAnyRole("ADMIN", "STAFF")
                        .requestMatchers(HttpMethod.PUT, "/api/ac-units/**").hasAnyRole("ADMIN", "STAFF")
                        .requestMatchers(HttpMethod.GET, "/api/ac-units", "/api/ac-units/**").authenticated()
                        .requestMatchers(HttpMethod.POST, "/api/service-reports").hasAnyRole("ADMIN", "STAFF")
                        .requestMatchers(HttpMethod.PUT, "/api/service-reports/**").hasAnyRole("ADMIN", "STAFF")
                        .requestMatchers(HttpMethod.GET, "/api/service-reports", "/api/service-reports/**").hasAnyRole("ADMIN", "STAFF", "CREW")
                        .requestMatchers(HttpMethod.POST, "/api/service-report-findings").hasAnyRole("ADMIN", "STAFF", "CREW")
                        .requestMatchers(HttpMethod.PUT, "/api/service-report-findings/**").hasAnyRole("ADMIN", "STAFF", "CREW")
                        .requestMatchers(HttpMethod.GET, "/api/service-report-findings", "/api/service-report-findings/**").hasAnyRole("ADMIN", "STAFF", "CREW")
                        .requestMatchers(HttpMethod.POST, "/api/service-report-billing-items").hasAnyRole("ADMIN", "ACCOUNTING")
                        .requestMatchers(HttpMethod.PUT, "/api/service-report-billing-items/**").hasAnyRole("ADMIN", "ACCOUNTING")
                        .requestMatchers(HttpMethod.GET, "/api/service-report-billing-items", "/api/service-report-billing-items/**").hasAnyRole("ADMIN", "ACCOUNTING", "STAFF", "CREW")
                        .requestMatchers(HttpMethod.POST, "/api/service-assignments").hasAnyRole("ADMIN", "STAFF")
                        .requestMatchers(HttpMethod.PUT, "/api/service-assignments/**").hasAnyRole("ADMIN", "STAFF")
                        .requestMatchers(HttpMethod.GET, "/api/service-assignments", "/api/service-assignments/**").hasAnyRole("ADMIN", "STAFF", "HR", "CREW")
                        .anyRequest().authenticated())
                .authenticationProvider(authenticationProvider())
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    /**
     * CORS configuration allowing requests from Hoppscotch and local dev servers.
     */
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(List.of(
                "https://hoppscotch.io",
                "http://localhost:800",
                "http://localhost:3000",
                "http://localhost:5173"));
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("*"));
        configuration.setExposedHeaders(List.of("Authorization"));
        configuration.setAllowCredentials(true);
        configuration.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }

    /**
     * DAO authentication provider with email-based user lookup and BCrypt password
     * verification.
     */
    @Bean
    public AuthenticationProvider authenticationProvider() {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider(userDetailsService);
        provider.setPasswordEncoder(passwordEncoder());
        return provider;
    }

    /** Exposes the AuthenticationManager bean for use in AuthService. */
    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }

    /** BCrypt password encoder for hashing and verifying user passwords. */
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}