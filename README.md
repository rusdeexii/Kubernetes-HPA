-docker build . -t localhpatest

- docker run -p 8080:8080 localhpatest:latest

- kubectl apply -f manifest.yml

-kubectl get pods

-kubectl apply -f server.yml

-kubectl get pods

-kubectl get service

-curl http://localhost:30080

Tutorial : https://medium.com/@dstrimble/kubernetes-horizontal-pod-autoscaling-for-local-development-d211e52c309c





