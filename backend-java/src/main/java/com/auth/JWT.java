package com.auth;

import java.util.Base64;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;

public class JWT {
    private static final String HEADER = "{\"alg\":\"HS256\",\"typ\":\"JWT\"}";

    private static String base64UrlEncode(byte[] bytes) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private static byte[] base64UrlDecode(String s) {
        return Base64.getUrlDecoder().decode(s);
    }

    public static String sign(String payloadJson, String secret) {
        try {
            String encodedHeader = base64UrlEncode(HEADER.getBytes(StandardCharsets.UTF_8));
            String encodedPayload = base64UrlEncode(payloadJson.getBytes(StandardCharsets.UTF_8));
            String dataToSign = encodedHeader + "." + encodedPayload;

            Mac sha256_HMAC = Mac.getInstance("HmacSHA256");
            SecretKeySpec secret_key = new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
            sha256_HMAC.init(secret_key);

            byte[] signatureBytes = sha256_HMAC.doFinal(dataToSign.getBytes(StandardCharsets.UTF_8));
            String signature = base64UrlEncode(signatureBytes);

            return dataToSign + "." + signature;
        } catch (Exception e) {
            throw new RuntimeException("Erro ao assinar JWT", e);
        }
    }

    public static String verifyAndGetPayload(String token, String secret) {
        try {
            String[] parts = token.split("\\.");
            if (parts.length != 3) {
                return null;
            }

            String header = parts[0];
            String payload = parts[1];
            String signature = parts[2];

            String dataToSign = header + "." + payload;

            Mac sha256_HMAC = Mac.getInstance("HmacSHA256");
            SecretKeySpec secret_key = new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
            sha256_HMAC.init(secret_key);

            byte[] expectedSignatureBytes = sha256_HMAC.doFinal(dataToSign.getBytes(StandardCharsets.UTF_8));
            String expectedSignature = base64UrlEncode(expectedSignatureBytes);

            if (signature.equals(expectedSignature)) {
                return new String(base64UrlDecode(payload), StandardCharsets.UTF_8);
            }
            return null;
        } catch (Exception e) {
            return null;
        }
    }
}
