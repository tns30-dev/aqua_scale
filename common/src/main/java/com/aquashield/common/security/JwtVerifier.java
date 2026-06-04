package com.aquashield.common.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;

import java.security.KeyFactory;
import java.security.PublicKey;
import java.security.spec.X509EncodedKeySpec;
import java.util.Base64;

/**
 * Local RS256 access-token verification for resource services — only Identity holds the
 * private key; everyone else verifies with the PUBLIC key (no shared secrets, no Identity
 * call per request). Checks: signature, issuer, audience, expiry.
 *
 * Standard claims: sub (userId), jti, role, authzVersion (pointer to the Redis snapshot).
 */
public final class JwtVerifier {

  public static final String CLAIM_ROLE = "role";
  public static final String CLAIM_AUTHZ_VERSION = "authzVersion";

  private final PublicKey publicKey;
  private final String issuer;
  private final String audience;

  public JwtVerifier(String publicKeyPem, String issuer, String audience) {
    this.publicKey = parsePublicKey(publicKeyPem);
    this.issuer = issuer;
    this.audience = audience;
  }

  public JwtVerifier(PublicKey publicKey, String issuer, String audience) {
    this.publicKey = publicKey;
    this.issuer = issuer;
    this.audience = audience;
  }

  /** Throws JwtException when invalid. */
  public Claims verify(String token) throws JwtException {
    return Jwts.parser()
        .verifyWith(publicKey)
        .requireIssuer(issuer)
        .requireAudience(audience)
        .build()
        .parseSignedClaims(token)
        .getPayload();
  }

  private static PublicKey parsePublicKey(String pem) {
    try {
      String stripped = pem.replace("-----BEGIN PUBLIC KEY-----", "")
          .replace("-----END PUBLIC KEY-----", "")
          .replaceAll("\\s", "");
      byte[] der = Base64.getDecoder().decode(stripped);
      return KeyFactory.getInstance("RSA").generatePublic(new X509EncodedKeySpec(der));
    } catch (Exception e) {
      throw new IllegalStateException("Invalid JWT public key PEM", e);
    }
  }
}
