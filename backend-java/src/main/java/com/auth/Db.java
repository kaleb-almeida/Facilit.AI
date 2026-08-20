package com.auth;
import java.io.BufferedReader;
import java.io.FileReader;
import java.io.File;
import java.sql.Connection;
import java.sql.DriverManager;
import java.util.HashMap;
import java.util.Map;

public class Db {
    private static Map<String, String> env = new HashMap<>();

    static {
        loadEnv();
    }

    private static void loadEnv() {
        File envFile = new File(".env");
        if (!envFile.exists()) {
            envFile = new File("../.env");
        }
        
        if (envFile.exists()) {
            try (BufferedReader br = new BufferedReader(new FileReader(envFile))) {
                String line;
                while ((line = br.readLine()) != null) {
                    line = line.trim();
                    if (line.isEmpty() || line.startsWith("#")) {
                        continue;
                    }
                    int eqIndex = line.indexOf('=');
                    if (eqIndex > 0) {
                        String key = line.substring(0, eqIndex).trim();
                        String value = line.substring(eqIndex + 1).trim();
                        if (value.startsWith("\"") && value.endsWith("\"")) {
                            value = value.substring(1, value.length() - 1);
                        } else if (value.startsWith("'") && value.endsWith("'")) {
                            value = value.substring(1, value.length() - 1);
                        }
                        env.put(key, value);
                    }
                }
            } catch (Exception e) {
                System.err.println("Aviso: Erro ao ler arquivo .env: " + e.getMessage());
            }
        }
    }

    public static String getEnv(String key, String defaultValue) {
        String value = System.getenv(key);
        if (value == null) {
            value = env.get(key);
        }
        return value != null ? value : defaultValue;
    }

    public static Connection getConnection() throws Exception {
        Class.forName("com.mysql.cj.jdbc.Driver");
        
        String dbUrl = getEnv("DATABASE_URL", "jdbc:mysql://localhost:3306/facilitai");
        
        String jdbcUrl = dbUrl;
        String user = "";
        String pass = "";

        if (dbUrl.startsWith("mysql://")) {
            String cleanUrl = dbUrl.substring("mysql://".length());
            if (cleanUrl.contains("@")) {
                String[] parts = cleanUrl.split("@");
                String credentials = parts[0];
                String hostAndDb = parts[1];

                if (credentials.contains(":")) {
                    String[] credParts = credentials.split(":");
                    user = credParts[0];
                    if (credParts.length > 1) {
                        pass = credParts[1];
                    }
                } else {
                    user = credentials;
                }
                jdbcUrl = "jdbc:mysql://" + hostAndDb;
            } else {
                jdbcUrl = "jdbc:mysql://" + cleanUrl;
            }
        } else if (!dbUrl.startsWith("jdbc:")) {
            jdbcUrl = "jdbc:" + dbUrl;
        }

        if (!user.isEmpty()) {
            return DriverManager.getConnection(jdbcUrl, user, pass);
        }
        return DriverManager.getConnection(jdbcUrl);
    }

    public static void initializeDatabase() {
        String createUsers = "CREATE TABLE IF NOT EXISTS users (" +
                "id INT AUTO_INCREMENT PRIMARY KEY, " +
                "nome VARCHAR(255) NOT NULL, " +
                "sobrenome VARCHAR(255) NOT NULL, " +
                "email VARCHAR(255) UNIQUE NOT NULL, " +
                "password_hash VARCHAR(255) NOT NULL, " +
                "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, " +
                "last_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP" +
                ")";
        String createConversations = "CREATE TABLE IF NOT EXISTS conversations (" +
                "id INT AUTO_INCREMENT PRIMARY KEY, " +
                "user_id INT, " +
                "ai_name VARCHAR(255) NOT NULL, " +
                "title VARCHAR(255) NOT NULL, " +
                "messages LONGTEXT NOT NULL, " +
                "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, " +
                "updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, " +
                "FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE" +
                ")";
        try (Connection conn = getConnection();
             java.sql.Statement stmt = conn.createStatement()) {
            stmt.execute(createUsers);
            stmt.execute(createConversations);
            System.out.println("Banco de dados (MySQL): tabelas verificadas/criadas.");
        } catch (Exception e) {
            System.err.println("Aviso: Não foi possível verificar/criar as tabelas no MySQL: " + e.getMessage());
        }
    }
}
