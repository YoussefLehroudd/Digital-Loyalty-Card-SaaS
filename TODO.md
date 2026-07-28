# TODO - Railway single-service Nginx + Laravel API + Reverb

- [ ] Update `backend/Dockerfile` to install and configure nginx + envsubst support with supervisor startup
- [ ] Update `backend/supervisord.conf` to run:
  - [ ] API on `127.0.0.1:8000`
  - [ ] Reverb on `127.0.0.1:8081`
  - [ ] Nginx via envsubst startup script using `$PORT`
- [ ] Create `backend/nginx.conf.template` with:
  - [ ] `/app/` proxy to Reverb (`127.0.0.1:8081`) including websocket headers
  - [ ] `/` proxy to API (`127.0.0.1:8000`)
  - [ ] `listen 0.0.0.0:${PORT}`
- [ ] Create `backend/start-nginx.sh` to render nginx config with envsubst then start nginx foreground
- [ ] Final review of changed files for syntax/consistency
