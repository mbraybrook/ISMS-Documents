#!/bin/bash
# Deploy updated backend image using CodeDeploy
# This creates a new task definition revision and triggers a blue/green deployment

set -e

PROFILE="${AWS_PROFILE:-pt-sandbox}"
REGION="${AWS_REGION:-eu-west-2}"

echo "🚀 Deploying updated backend image with CodeDeploy"
echo ""

# Get cluster and service names
CLUSTER_NAME=$(aws cloudformation describe-stacks \
  --stack-name isms-staging-ecs \
  --query 'Stacks[0].Outputs[?OutputKey==`ClusterName`].OutputValue' \
  --output text \
  --profile $PROFILE \
  --region $REGION)

BACKEND_SERVICE=$(aws cloudformation describe-stacks \
  --stack-name isms-staging-ecs \
  --query 'Stacks[0].Outputs[?OutputKey==`BackendServiceName`].OutputValue' \
  --output text \
  --profile $PROFILE \
  --region $REGION)

echo "Cluster: $CLUSTER_NAME"
echo "Service: $BACKEND_SERVICE"
echo ""

# Get current task definition
echo "📋 Getting current task definition..."
CURRENT_TASK_DEF=$(aws ecs describe-services \
  --cluster $CLUSTER_NAME \
  --services $BACKEND_SERVICE \
  --query 'services[0].taskDefinition' \
  --output text \
  --profile $PROFILE \
  --region $REGION)

echo "Current task definition: $CURRENT_TASK_DEF"
echo ""

# Get backend image URI
BACKEND_REPO=$(aws cloudformation describe-stacks \
  --stack-name isms-staging-ecr \
  --query 'Stacks[0].Outputs[?OutputKey==`BackendRepositoryUri`].OutputValue' \
  --output text \
  --profile $PROFILE \
  --region $REGION)

NEW_IMAGE="${BACKEND_REPO}:staging"
echo "New image: $NEW_IMAGE"
echo ""

# Get task definition JSON
echo "📝 Creating new task definition revision..."
TEMP_FILE=$(mktemp)
aws ecs describe-task-definition \
  --task-definition $CURRENT_TASK_DEF \
  --query 'taskDefinition' \
  --output json \
  --profile $PROFILE \
  --region $REGION > $TEMP_FILE

# Get ApplicationSecretsArn for CORS configuration
APP_SECRET_ARN=$(aws cloudformation describe-stacks \
  --stack-name isms-staging-secrets \
  --query 'Stacks[0].Outputs[?OutputKey==`ApplicationSecretsArn`].OutputValue' \
  --output text \
  --profile $PROFILE \
  --region $REGION)

# Update image and add CORS secret if not already present
UPDATED_TASK_DEF_FILE=$(mktemp)
cat $TEMP_FILE | jq \
  --arg IMAGE "$NEW_IMAGE" \
  --arg SECRET_ARN "${APP_SECRET_ARN}:CORS_TRUST_CENTER_ORIGINS::" \
  '
  .containerDefinitions[0].image = $IMAGE |
  # Add CORS_TRUST_CENTER_ORIGINS secret if not already present
  .containerDefinitions[0].secrets = (
    .containerDefinitions[0].secrets + 
    [{
      "name": "CORS_TRUST_CENTER_ORIGINS",
      "valueFrom": $SECRET_ARN
    }]
  ) |
  # Remove duplicates based on name
  .containerDefinitions[0].secrets |= (
    . | group_by(.name) | map(.[0])
  ) |
  del(.taskDefinitionArn) |
  del(.revision) |
  del(.status) |
  del(.requiresAttributes) |
  del(.compatibilities) |
  del(.registeredAt) |
  del(.registeredBy)
' > $UPDATED_TASK_DEF_FILE

# Register new task definition
NEW_TASK_DEF_ARN=$(aws ecs register-task-definition \
  --cli-input-json file://$UPDATED_TASK_DEF_FILE \
  --profile $PROFILE \
  --region $REGION \
  --query 'taskDefinition.taskDefinitionArn' \
  --output text)

echo "✅ New task definition created: $NEW_TASK_DEF_ARN"
rm $TEMP_FILE $UPDATED_TASK_DEF_FILE
echo ""

# Create CodeDeploy deployment
echo "🚀 Creating CodeDeploy deployment..."
APP_NAME="isms-staging-backend-app"
DG_NAME="isms-staging-backend-dg"

# Create AppSpec JSON
APPSPEC_FILE=$(mktemp)
cat > $APPSPEC_FILE <<EOF
{
  "version": 0.0,
  "Resources": [{
    "TargetService": {
      "Type": "AWS::ECS::Service",
      "Properties": {
        "TaskDefinition": "${NEW_TASK_DEF_ARN}",
        "LoadBalancerInfo": {
          "ContainerName": "backend",
          "ContainerPort": 4000
        }
      }
    }
  }]
}
EOF

# Create deployment input JSON with AppSpec content as a JSON string
# The content field needs the AppSpec JSON as a string (not an object)
DEPLOYMENT_INPUT_FILE=$(mktemp)
APPSPEC_COMPACT=$(jq -c '.' $APPSPEC_FILE)
jq -n \
  --arg appName "$APP_NAME" \
  --arg dgName "$DG_NAME" \
  --arg appSpecContent "$APPSPEC_COMPACT" \
  '{
    "applicationName": $appName,
    "deploymentGroupName": $dgName,
    "revision": {
      "revisionType": "AppSpecContent",
      "appSpecContent": {
        "content": $appSpecContent
      }
    }
  }' > $DEPLOYMENT_INPUT_FILE

rm $APPSPEC_FILE

DEPLOYMENT_ID=$(aws deploy create-deployment \
  --cli-input-json file://$DEPLOYMENT_INPUT_FILE \
  --region $REGION \
  --profile $PROFILE \
  --query 'deploymentId' \
  --output text)

rm $DEPLOYMENT_INPUT_FILE

echo "✅ CodeDeploy deployment created: $DEPLOYMENT_ID"
echo ""
echo "📊 Monitor deployment:"
echo "   aws deploy get-deployment --deployment-id $DEPLOYMENT_ID --region $REGION --profile $PROFILE"
echo ""
echo "📋 View deployment status:"
echo "   aws deploy list-deployments --application-name $APP_NAME --deployment-group-name $DG_NAME --region $REGION --profile $PROFILE --max-items 1"
echo ""
echo "✨ Deployment started! CodeDeploy will perform a blue/green deployment with zero downtime."

