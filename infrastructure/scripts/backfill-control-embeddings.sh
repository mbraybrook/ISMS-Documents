#!/bin/bash
# Backfill control embeddings in staging/production database

set -euo pipefail

ENVIRONMENT="${1:-staging}"
AWS_PROFILE="${AWS_PROFILE:-pt-sandbox}"
AWS_REGION="${AWS_REGION:-eu-west-2}"
BATCH_SIZE="${BATCH_SIZE:-20}"
CONCURRENCY="${CONCURRENCY:-2}"

echo "🔄 Backfilling control embeddings..."
echo "Environment: $ENVIRONMENT"
echo "Batch size: $BATCH_SIZE"
echo "Concurrency: $CONCURRENCY"
echo ""

# Get cluster name
CLUSTER_NAME=$(aws cloudformation describe-stacks \
  --stack-name "isms-${ENVIRONMENT}-ecs" \
  --query 'Stacks[0].Outputs[?OutputKey==`ClusterName`].OutputValue' \
  --output text \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" 2>/dev/null || echo "")

if [ -z "$CLUSTER_NAME" ]; then
  echo "❌ Could not find ECS cluster. Is the ECS stack deployed?"
  exit 1
fi

# Get backend task
echo "📋 Finding backend task..."
BACKEND_TASK=$(aws ecs list-tasks \
  --cluster "$CLUSTER_NAME" \
  --service-name "isms-${ENVIRONMENT}-backend" \
  --query 'taskArns[0]' \
  --output text \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION")

if [ -z "$BACKEND_TASK" ] || [ "$BACKEND_TASK" == "None" ]; then
  echo "❌ Backend service task not found. Is the backend service running?"
  exit 1
fi

echo "✅ Found backend task: $BACKEND_TASK"
echo ""

# Check if AI service is available (required for embeddings)
echo "🔍 Verifying AI service is available..."
AI_SERVICE_STATUS=$(aws ecs describe-services \
  --cluster "$CLUSTER_NAME" \
  --services "isms-${ENVIRONMENT}-ai-service" \
  --query 'services[0].runningCount' \
  --output text \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" 2>/dev/null || echo "0")

if [ "$AI_SERVICE_STATUS" == "0" ] || [ -z "$AI_SERVICE_STATUS" ]; then
  echo "❌ AI service is not running. Embeddings require the AI service."
  echo "   Deploy AI service first (see DEPLOYMENT.md section 9.6)"
  exit 1
fi

echo "✅ AI service is running"
echo ""

# Run backfill via ECS Exec
echo "🚀 Starting embedding backfill..."
echo "   This may take 10-30 minutes depending on the number of controls..."
echo "   Monitor progress in CloudWatch logs: /ecs/isms-${ENVIRONMENT}-backend"
echo ""

# Use ECS Exec to run the backfill script
if aws ecs execute-command \
  --cluster "$CLUSTER_NAME" \
  --task "$BACKEND_TASK" \
  --container backend \
  --command "cd /app && npm run backfill-control-embeddings -- --batch-size $BATCH_SIZE --concurrency $CONCURRENCY" \
  --interactive \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION"; then
  echo ""
  echo "✅ Embedding backfill complete!"
  echo ""
  echo "💡 Verify embeddings were created:"
  echo "   ./scripts/check-control-embeddings.sh $ENVIRONMENT"
else
  echo ""
  echo "⚠️  ECS Exec failed or not enabled."
  echo ""
  echo "Alternative: Run backfill manually via backend API or database connection."
  echo ""
  echo "Or enable ECS Exec on the backend task definition:"
  echo "  EnableExecuteCommand: true"
fi
