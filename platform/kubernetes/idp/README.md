# IDP Kubernetes Manifests

This folder contains the Kubernetes manifests that publish the IDP web application inside the `idp-system` namespace.

## Files

- `base.yaml`: namespace, service account, RBAC, and the `idp-web` service.
- `deployment.yaml`: the `idp-web` deployment that runs the Next.js application.
- `ingress.yaml`: the public HTTP entry point that routes traffic from the cluster ingress controller to the `idp-web` service.

## How Public Access Works

The IDP is exposed to the internet through an existing AKS web app routing ingress controller.

The request flow is:

1. DNS resolves the selected hostname to the public IP of the ingress controller.
2. The Azure load balancer in front of the ingress controller accepts the incoming request.
3. The ingress controller matches the `Host` header against the rule in `ingress.yaml`.
4. Matching traffic is forwarded to the Kubernetes service `idp-web` on port `80`.
5. The service forwards the request to the application container on port `3000`.

## How The Hostname Is Constructed

By default, the deployment script does not require a custom domain.

If `INGRESS_HOST` is unset, `scripts/azure/deploy-platform-to-aks.sh` reads the public IP of the ingress controller service:

- namespace: `app-routing-system`
- service: `nginx`

It then derives a hostname in this format:

```text
idp.<public-ip>.sslip.io
```

Example:

```text
idp.20.14.0.5.sslip.io
```

`sslip.io` is a wildcard DNS service that resolves hostnames containing an IP address back to that IP. That gives the cluster a usable public hostname without first setting up a real DNS zone.

## How The Ingress Manifest Is Applied

`ingress.yaml` is a template. The deployment script replaces placeholders before applying it:

- `INGRESS_CLASS_NAME_PLACEHOLDER`
- `INGRESS_HOST_PLACEHOLDER`

The rendered ingress looks conceptually like this:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: idp-web
  namespace: idp-system
spec:
  ingressClassName: webapprouting.kubernetes.azure.com
  rules:
    - host: idp.20.14.0.5.sslip.io
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: idp-web
                port:
                  number: 80
```

## Why `NEXTAUTH_URL` Is Updated

The app uses NextAuth, so it needs to know its public base URL.

During deployment, the script rebuilds the `idp-app-env` secret and forces `NEXTAUTH_URL` to match the public host. If `NEXTAUTH_EXTERNAL_URL` is unset, it defaults to:

```text
http://<ingress-host>
```

That keeps sign-in and callback URL generation aligned with the hostname that users reach from the internet.

## Overriding The Defaults

You can provide explicit values at deploy time:

```bash
INGRESS_HOST=idp.example.com \
NEXTAUTH_EXTERNAL_URL=https://idp.example.com \
bash scripts/azure/deploy-platform-to-aks.sh
```

Use this when moving from the temporary `sslip.io` hostname to a real domain.

## Adding HTTPS And TLS

The current ingress manifest is HTTP-only, but the path to HTTPS is straightforward.

To move to TLS:

1. Use a real DNS name such as `idp.example.com` instead of the temporary `sslip.io` hostname.
2. Point that hostname at the public IP of the ingress controller.
3. Provision a TLS certificate for that hostname.
4. Create a Kubernetes TLS secret in `idp-system`.
5. Add a `tls` section to the ingress and keep the host name aligned with the certificate.
6. Set `NEXTAUTH_EXTERNAL_URL` to the final `https://` URL before deployment.

Conceptually, the ingress would become:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: idp-web
  namespace: idp-system
spec:
  ingressClassName: webapprouting.kubernetes.azure.com
  tls:
    - hosts:
        - idp.example.com
      secretName: idp-web-tls
  rules:
    - host: idp.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: idp-web
                port:
                  number: 80
```

With that in place, the corresponding deploy command should use the HTTPS public URL:

```bash
INGRESS_HOST=idp.example.com \
NEXTAUTH_EXTERNAL_URL=https://idp.example.com \
bash scripts/azure/deploy-platform-to-aks.sh
```

The important rule is consistency: the certificate host, the ingress host, DNS, and `NEXTAUTH_EXTERNAL_URL` all need to match.

## Important Notes

- The current manifest in this repository still publishes HTTP only. The TLS section above describes the next step for production hardening.
- The cluster must already have an ingress controller for the configured ingress class.
- For Entra ID sign-in to work publicly, the app registration must include the public callback URL for the chosen hostname.
