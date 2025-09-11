#!/bin/bash

echo "🚀 Deploying Excelidraw App to Kubernetes..."

# Apply namespace first
echo "📦 Creating namespace..."
kubectl apply -f k8s/namespace.yaml

# Apply secrets and configmaps
echo "🔐 Creating secrets and configmaps..."
kubectl apply -f k8s/secrets.yaml
kubectl apply -f k8s/configmap.yaml

# Apply PVC
echo "💾 Creating persistent volume claims..."
kubectl apply -f k8s/postgres-pvc.yaml

# Apply database
echo "🗄️ Deploying PostgreSQL..."
kubectl apply -f k8s/postgres-deployment.yaml

# Wait for postgres to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
kubectl wait --for=condition=available --timeout=300s deployment/excelidraw-postgres -n excelidraw

# Apply backend services
echo "🔧 Deploying backend services..."
kubectl apply -f k8s/http-backend-deployment.yaml
kubectl apply -f k8s/ws-backend-deployment.yaml

# Wait for backends to be ready
echo "⏳ Waiting for backend services to be ready..."
kubectl wait --for=condition=available --timeout=300s deployment/excelidraw-http-backend -n excelidraw
kubectl wait --for=condition=available --timeout=300s deployment/excelidraw-ws-backend -n excelidraw

# Apply frontend
echo "🎨 Deploying frontend..."
kubectl apply -f k8s/frontend-deployment.yaml

# Wait for frontend to be ready
echo "⏳ Waiting for frontend to be ready..."
kubectl wait --for=condition=available --timeout=300s deployment/excelidraw-frontend -n excelidraw

# Apply ingress
echo "🌐 Setting up ingress..."
kubectl apply -f k8s/ingress.yaml

echo "✅ Deployment complete!"
echo "🌍 Your app will be available at: https://excelidraw.abhishek97.icu"
echo "📊 Check status with: kubectl get pods -n excelidraw"