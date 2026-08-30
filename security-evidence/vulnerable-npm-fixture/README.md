# Security Evidence Fixture

This directory is intentionally used only for CI security-scanning evidence.
It is not imported by the AquaShield application and is not part of any runtime
Docker image.

The first evidence commit keeps a vulnerable dependency in `package-lock.json`
so Trivy can fail the CI security gate. The follow-up evidence commit removes
this fixture to show the remediation and successful rescan.
