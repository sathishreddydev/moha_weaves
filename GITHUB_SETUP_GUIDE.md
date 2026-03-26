# GitHub Setup Guide for Moha Weaves

## ✅ Completed Setup

### 1. Branch Structure
- `main` → Production
- `beta` → Staging  
- `develop` → Development

### 2. GitHub Workflows
- `deploy-dev.yml` - Auto-deploy on push to `develop`
- `deploy-beta.yml` - Auto-deploy on push to `beta`
- `deploy-prod.yml` - Auto-deploy on push to `main`

## ⏳ Remaining GitHub Setup

### 1. Branch Protection (Manual Setup)

**Go to:** https://github.com/sathishreddydev/moha_weaves/settings/branches

**Add rule for `main` branch:**
- ✅ Require pull request reviews before merging
- ✅ Require approval from 1 reviewer
- ✅ Dismiss stale PR approvals when new commits are pushed
- ✅ Require status checks to pass before merging
- ✅ Require branches to be up to date before merging

**Required status checks:**
- `Deploy to Production` (workflow)
- `build-and-deploy` (job)

### 2. GitHub Secrets Required

**Azure Authentication (add after Azure setup):**
- `DEV_AZUREAPPSERVICE_CLIENTID`
- `DEV_AZUREAPPSERVICE_TENANTID`
- `DEV_AZUREAPPSERVICE_SUBSCRIPTIONID`
- `BETA_AZUREAPPSERVICE_CLIENTID`
- `BETA_AZUREAPPSERVICE_TENANTID`
- `BETA_AZUREAPPSERVICE_SUBSCRIPTIONID`
- `PROD_AZUREAPPSERVICE_CLIENTID`
- `PROD_AZUREAPPSERVICE_TENANTID`
- `PROD_AZUREAPPSERVICE_SUBSCRIPTIONID`

**Application Secrets (add now):**
- `DEV_DATABASE_URL`, `BETA_DATABASE_URL`, `PROD_DATABASE_URL`
- `DEV_RAZORPAY_KEY_ID`, `BETA_RAZORPAY_KEY_ID`, `PROD_RAZORPAY_KEY_ID`
- `DEV_RAZORPAY_KEY_SECRET`, `BETA_RAZORPAY_KEY_SECRET`, `PROD_RAZORPAY_KEY_SECRET`
- `DEV_DELHIVERY_API_TOKEN`, `BETA_DELHIVERY_API_TOKEN`, `PROD_DELHIVERY_API_TOKEN`
- `DEV_DELHIVERY_CLIENT_ID`, `BETA_DELHIVERY_CLIENT_ID`, `PROD_DELHIVERY_CLIENT_ID`
- `DEV_JWT_SECRET`, `BETA_JWT_SECRET`, `PROD_JWT_SECRET`
- `DEV_SESSION_SECRET`, `BETA_SESSION_SECRET`, `PROD_SESSION_SECRET`

## 🚀 Deployment Workflow

### Development Process
```bash
# 1. Create feature branch
git checkout -b feature/new-feature

# 2. Make changes and commit
git add .
git commit -m "Add new feature"
git push origin feature/new-feature

# 3. Create PR to develop branch
# 4. After review and merge, auto-deploys to dev
```

### Promotion Process
```bash
# After testing in dev:
git checkout beta
git merge develop
git push origin beta  # Auto-deploys to beta

# After testing in beta:
git checkout main
git merge beta
git push origin main   # Auto-deploys to production
```

## 📋 Next Steps

1. **Configure branch protection** (GitHub UI)
2. **Add GitHub secrets** (GitHub UI)
3. **Set up Azure resources** (run setup script)
4. **Test deployment workflow**

## 🔗 Useful Links

- GitHub Repository: https://github.com/sathishreddydev/moha_weaves
- Branch Protection: https://github.com/sathishreddydev/moha_weaves/settings/branches
- GitHub Secrets: https://github.com/sathishreddydev/moha_weaves/settings/secrets/actions
- Actions Monitoring: https://github.com/sathishreddydev/moha_weaves/actions

## 🎯 GitHub Setup Status

- [x] Branch structure created
- [x] Deployment workflows created
- [x] Scripts committed and pushed
- [ ] Branch protection configured
- [ ] GitHub secrets added
- [ ] Azure resources created
- [ ] End-to-end testing completed
