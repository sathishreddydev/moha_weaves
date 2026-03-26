#!/bin/bash

# Azure Full Automation Setup for Moha Weaves
# Creates all resources and generates GitHub secrets

set -e

# Configuration
RESOURCE_GROUP="moha-weaves-rg"
LOCATION="eastus"

# App Services
DEV_APP="mohaweaves-dev"
BETA_APP="mohaweaves-beta"
PROD_APP="mohaweaves-prod"

# App Service Plans
DEV_PLAN="moha-weaves-dev-plan"
BETA_PLAN="moha-weaves-beta-plan"
PROD_PLAN="moha-weaves-prod-plan"

echo "🚀 Setting up Azure Full Automation for Moha Weaves..."

# Check Azure CLI
if ! command -v az &> /dev/null; then
    echo "❌ Install Azure CLI first: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
    exit 1
fi

# Login check
echo "🔐 Checking Azure login..."
az account show > /dev/null || {
    echo "Please run 'az login' first"
    exit 1
}

# Create Resource Group
echo "📦 Creating resource group..."
az group create --name "$RESOURCE_GROUP" --location "$LOCATION" --output none

# Create App Service Plans
echo "🔧 Creating App Service Plans..."
az appservice plan create --name "$DEV_PLAN" --resource-group "$RESOURCE_GROUP" --sku B1 --is-linux --output none
az appservice plan create --name "$BETA_PLAN" --resource-group "$RESOURCE_GROUP" --sku B2 --is-linux --output none
az appservice plan create --name "$PROD_PLAN" --resource-group "$RESOURCE_GROUP" --sku P1v3 --is-linux --output none

# Create Web Apps
echo "🌐 Creating Web Apps..."
az webapp create --name "$DEV_APP" --resource-group "$RESOURCE_GROUP" --plan "$DEV_PLAN" --runtime "NODE|22-lts" --output none
az webapp create --name "$BETA_APP" --resource-group "$RESOURCE_GROUP" --plan "$BETA_PLAN" --runtime "NODE|22-lts" --output none
az webapp create --name "$PROD_APP" --resource-group "$RESOURCE_GROUP" --plan "$PROD_PLAN" --runtime "NODE|22-lts" --output none

# Get URLs
DEV_URL=$(az webapp show --name "$DEV_APP" --resource-group "$RESOURCE_GROUP" --query "defaultHostName" -o tsv)
BETA_URL=$(az webapp show --name "$BETA_APP" --resource-group "$RESOURCE_GROUP" --query "defaultHostName" -o tsv)
PROD_URL=$(az webapp show --name "$PROD_APP" --resource-group "$RESOURCE_GROUP" --query "defaultHostName" -o tsv)

# Create Service Principals
echo "🔑 Creating Service Principals for GitHub Actions..."
SUBSCRIPTION_ID=$(az account show --query "id" -o tsv)

for ENV in dev beta prod; do
    SP_NAME="mohaweaves-${ENV}-sp"
    
    echo "Creating Service Principal for $ENV..."
    SP_OUTPUT=$(az ad sp create-for-rbac \
        --name "$SP_NAME" \
        --role "Contributor" \
        --scopes "/subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP" \
        --json-auth 2>/dev/null)
    
    CLIENT_ID=$(echo "$SP_OUTPUT" | jq -r .clientId)
    TENANT_ID=$(echo "$SP_OUTPUT" | jq -r .tenantId)
    CLIENT_SECRET=$(echo "$SP_OUTPUT" | jq -r .clientSecret)
    
    echo ""
    echo "🔗 ${ENV^} Environment GitHub Secrets:"
    echo "======================================"
    echo "${ENV^^}_AZUREAPPSERVICE_CLIENTID=$CLIENT_ID"
    echo "${ENV^^}_AZUREAPPSERVICE_TENANTID=$TENANT_ID"
    echo "${ENV^^}_AZUREAPPSERVICE_SUBSCRIPTIONID=$SUBSCRIPTION_ID"
    echo ""
    echo "🌐 ${ENV^} URL: https://$DEV_URL"
    echo ""
done

echo "✅ Azure setup completed!"
echo ""
echo "📝 Next Steps:"
echo "=============="
echo "1. Add the GitHub secrets above to your repository"
echo "2. Set up Neon databases for each environment"
echo "3. Configure app settings in Azure Portal"
echo "4. Push to branches to trigger deployments"
