package com.aquashield.identity.service;

import com.aquashield.identity.config.JwtProperties;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.security.KeyFactory;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.X509EncodedKeySpec;
import java.time.Instant;
import java.util.Base64;
import java.util.Date;
import java.util.UUID;

/**
 * JWT access tokens, RS256 (asymmetric so other services verify with the public key only).
 *
 * Claims kept COMPACT per main/authn_authz.md: sub (userId), jti, role summary, authzVersion
 * (pointer to the Redis snapshot) — never the full permission matrix.
 *
 * Keys: PEM via env/secret in cloud; if absent (local dev / tests) an ephemeral keypair is
 * generated and a warning logged.
 */
@Service
public class TokenService {

  private static final Logger log = LoggerFactory.getLogger(TokenService.class);

  public static final String CLAIM_ROLE = "role";
  public static final String CLAIM_AUTHZ_VERSION = "authzVersion";

  private final JwtProperties props;
  private final PrivateKey privateKey;
  private final PublicKey publicKey;

  public TokenService(JwtProperties props) {
    this.props = props;
    if (props.privateKeyPem() == null || props.privateKeyPem().isBlank()) {
      log.warn("No JWT keypair configured — generating EPHEMERAL dev keypair. "
          + "Tokens will not survive restarts. Configure JWT_PRIVATE_KEY_PEM in cloud.");
      KeyPair kp = generateKeyPair();
      this.privateKey = kp.getPrivate();
      this.publicKey = kp.getPublic();
    } else {
      this.privateKey = parsePrivateKey(props.privateKeyPem());
      this.publicKey = parsePublicKey(props.publicKeyPem());
    }
  }

  public record IssuedToken(String token, String jti, Instant expiresAt) {}

  public IssuedToken issueAccessToken(UUID userId, String role, long authzVersion) {
    String jti = UUID.randomUUID().toString();
    Instant now = Instant.now();
    Instant exp = now.plus(props.accessTokenTtl());
    String token = Jwts.builder()
        .subject(userId.toString())
        .id(jti)
        .issuer(props.issuer())
        .audience().add(props.audience()).and()
        .claim(CLAIM_ROLE, role)
        .claim(CLAIM_AUTHZ_VERSION, authzVersion)
        .issuedAt(Date.from(now))
        .expiration(Date.from(exp))
        .signWith(privateKey, Jwts.SIG.RS256)
        .compact();
    return new IssuedToken(token, jti, exp);
  }

  /** Local validation: signature, issuer, audience, expiry. Throws JwtException when invalid. */
  public Claims validate(String token) throws JwtException {
    return Jwts.parser()
        .verifyWith(publicKey)
        .requireIssuer(props.issuer())
        .requireAudience(props.audience())
        .build()
        .parseSignedClaims(token)
        .getPayload();
  }

  private static KeyPair generateKeyPair() {
    try {
      KeyPairGenerator gen = KeyPairGenerator.getInstance("RSA");
      gen.initialize(2048);
      return gen.generateKeyPair();
    } catch (Exception e) {
      throw new IllegalStateException("Cannot generate RSA keypair", e);
    }
  }

  private static PrivateKey parsePrivateKey(String pem) {
    try {
      byte[] der = Base64.getDecoder().decode(stripPem(pem, "PRIVATE KEY"));
      return KeyFactory.getInstance("RSA").generatePrivate(new PKCS8EncodedKeySpec(der));
    } catch (Exception e) {
      throw new IllegalStateException("Invalid JWT private key PEM", e);
    }
  }

  private static PublicKey parsePublicKey(String pem) {
    try {
      byte[] der = Base64.getDecoder().decode(stripPem(pem, "PUBLIC KEY"));
      return KeyFactory.getInstance("RSA").generatePublic(new X509EncodedKeySpec(der));
    } catch (Exception e) {
      throw new IllegalStateException("Invalid JWT public key PEM", e);
    }
  }

  private static String stripPem(String pem, String type) {
    return pem.replace("-----BEGIN " + type + "-----", "")
        .replace("-----END " + type + "-----", "")
        .replaceAll("\\s", "");
  }
}
