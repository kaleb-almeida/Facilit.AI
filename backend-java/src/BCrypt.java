import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;

public class BCrypt {
    
    public static String hashpw(String password, String salt) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            String combined = password + salt;
            byte[] hash = digest.digest(combined.getBytes("UTF-8"));
            
            // 1000 iterações de SHA-256 para esticamento de chave (Key Stretching)
            for (int i = 0; i < 1000; i++) {
                hash = digest.digest(hash);
            }
            return salt + "$" + Base64.getEncoder().encodeToString(hash);
        } catch (Exception e) {
            throw new RuntimeException("Erro ao gerar hash da senha", e);
        }
    }

    public static String gensalt() {
        SecureRandom random = new SecureRandom();
        byte[] saltBytes = new byte[16];
        random.nextBytes(saltBytes);
        return Base64.getEncoder().encodeToString(saltBytes);
    }

    public static boolean checkpw(String plaintext, String hashed) {
        if (hashed == null || !hashed.contains("$")) {
            return false;
        }
        try {
            int dollarIndex = hashed.indexOf('$');
            String salt = hashed.substring(0, dollarIndex);
            String rehashed = hashpw(plaintext, salt);
            return rehashed.equals(hashed);
        } catch (Exception e) {
            return false;
        }
    }
}
