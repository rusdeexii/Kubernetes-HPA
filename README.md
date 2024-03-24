Next we’re going to write a really simple node.js application that does some random math so we can get some decent CPU usage.

You will need NPM and Node.js installed. I’ll be using node v8.9.1 and npm v5.5.1

Create package.json

{
  "name": "localhpatest",
  "version": "1.0.0",
  "description": "Node.js on Docker",
  "author": "daniel.trimble@jbhunt.com",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.16.1"
  }
}
Create server.js

'use strict';
const express = require('express');
const PORT = 8080;
const HOST = '0.0.0.0';
const app = express();
app.get('/', (req, res) => {
  var i;
  for(var z =0;  z < getRandomInt(9999999); z++){
    i = Math.sqrt(getRandomInt(9999999)).toString()
  }
  console.log(i);
  res.send(i);
});
function getRandomInt(max) {
  return Math.floor(Math.random() * Math.floor(max));
}
app.get('/healthz', (req, res) => {
  res.send({status: "UP"});
});
app.listen(PORT, HOST);
console.log(`Running on http://${HOST}:${PORT}`);
Nothing crazy here. Using express, create a http method that does some random math to simulate some CPU usage, and another one for a basic app health check. The health check will be important later for kubernetes probes.

Next we will create the Dockerfile.

FROM node:8
# Create app directory
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm config set strict-ssl false
RUN npm install
# Bundle app source
COPY . .
EXPOSE 8080
CMD [ "npm", "start" ]
This Dockerfile will use the node version 8 image as it’s base, copy in your code, run an npm install, expose the port 8080, and setup the start command for docker.

So far, you have all of the basic code to run a basic Docker app using node.js. Give it a shot.

> docker build . -t localhpatest
Sending build context to Docker daemon   34.3kB
Step 1/8 : FROM node:8
8: Pulling from library/node
741437d97401: Pull complete
34d8874714d7: Pull complete
0a108aa26679: Pull complete
7f0334c36886: Pull complete
65c95cb8b3be: Pull complete
a36b708560f8: Pull complete
81a7e69fab67: Pull complete
a88b577be604: Pull complete
Digest: sha256:a8a9d8eaab36bbd188612375a54fb7f57418458812dabd50769ddd3598bc24fc
Status: Downloaded newer image for node:8
 ---> 4f01e5319662
Step 2/8 : WORKDIR /usr/src/app
 ---> Running in c1a5430f6c62
Removing intermediate container c1a5430f6c62
 ---> 89c6b8bf4722
Step 3/8 : COPY package*.json ./
 ---> ca9e8776058d
Step 4/8 : RUN npm config set strict-ssl false
 ---> Running in 1986c82ee387
Removing intermediate container 1986c82ee387
 ---> cc661c72dad7
Step 5/8 : RUN npm install
 ---> Running in ad141026d7c2
npm WARN localhpatest@1.0.0 No repository field.
npm WARN localhpatest@1.0.0 No license field.
added 48 packages from 36 contributors and audited 121 packages in 3.405s
found 0 vulnerabilities
Removing intermediate container ad141026d7c2
 ---> 4ed8663766ad
Step 6/8 : COPY . .
 ---> 704e74f5946f
Step 7/8 : EXPOSE 8080
 ---> Running in 5d9bbcd8e3ee
Removing intermediate container 5d9bbcd8e3ee
 ---> 19d65f87dc0c
Step 8/8 : CMD [ "npm", "start" ]
 ---> Running in b19610c73087
Removing intermediate container b19610c73087
 ---> c8618567d566
Successfully built c8618567d566
Successfully tagged localhpatest:latest
Then give it a run.

> docker run -p 8080:8080 localhpatest:latest
> localhpatest@1.0.0 start /usr/src/app
> node server.js
Running on http://0.0.0.0:8080
Hitting http://localhost:8080 in chrome will give you something similar to this


Kill that off so that we don’t get confused later:

> docker ps
CONTAINER ID        IMAGE                                      COMMAND                  CREATED             STATUS              PORTS                    NAMES
48cd50d75ec3        localhpatest:latest                        "npm start"              3 minutes ago       Up 2 minutes        0.0.0.0:8080->8080/tcp   modest_shockley
3f0f6f7308fc        k8s.gcr.io/pause-amd64:3.1                 "/pause"                 9 minutes ago       Up 9 minutes                                 k8s_POD_localhpatest-7b4
...
> docker stop 48cd50d75ec3
> docker rm 48cd50d75ec3
Kubernetes deployment
Next we will set it up to run in our local kubernetes cluster as is.

Create a manifest.yml in your project root folder.

apiVersion: extensions/v1beta1
kind: Deployment
metadata:
  name: localhpatest
  labels:
    component: localhpatest
spec:
  replicas: 1
  selector:
    matchLabels:
      component: "localhpatest"
  template:
    metadata:
      labels:
        component: "localhpatest"
    spec:
      containers:
        - name: localhpatest
          image: "localhpatest:latest"
          imagePullPolicy: "Never"
          ports:
          - name: http
            containerPort: 8080
          resources:
            requests:
              cpu: "50m"
              memory: "64Mi"
            limits: 
              cpu: "100m"
              memory: "256Mi"
          livenessProbe:
            httpGet:
              path: /healthz
              port: http
            timeoutSeconds: 5
            initialDelaySeconds: 20
          readinessProbe:
            httpGet:
              path: /healthz
              port: http
            timeoutSeconds: 5
            initialDelaySeconds: 20
This is a pretty basic kubernetes Deployment. It’s using your recently built localhpatest image and creating a single replica in the default namespace. Important concepts here are the probes and resources. These are a must have in every kubernetes deployment.

The probes are monitoring your application to make sure it’s up and ready (readiness) and still alive and taking requests (liveness). We’re using the /healthz method that we created earlier in server.js here.

The resources are important for kubernetes to know how and where to schedule your application. If you have a 5 node cluster and only one node has enough available resources to run your application, kubernetes will know based on these settings where to run it. It’s important to understand that running your container via docker by default gives it way more resources that what it might see within kubernetes, because of the resource limits we specified in this file.

Let’s run it.

First, check that your cluster is running

> kubectl get nodes
NAME                 STATUS    ROLES     AGE       VERSION
docker-for-desktop   Ready     master    58m       v1.10.3
Now let’s run the app.

> kubectl apply -f manifest.yml
deployment.extensions "localhpatest" created
> kubectl get pods
NAME                            READY     STATUS    RESTARTS   AGE
localhpatest-7b4d9ffbcc-9fvd8   1/1       Running   0          1m
Depending on how quickly you run ‘get pods’ you may or may not see 1/1 for the ready status.

As it is, there’s really no way to access the deployment because we didn’t expose it outside of the cluster and we didn’t setup a service to load balance the requests. If you hit http://localhost:8080 right now and do get a response, it’s probably because you left the docker image running above.

Let’s add a service and expose it to via NodePort. Update your manifest.yml.

apiVersion: v1
kind: Service
metadata:
  name: localhpatest
  labels:
    component: localhpatest
spec:
  ports:
    - port: 8080
      nodePort: 30080
  selector:
    component: localhpatest
  type: "NodePort"
---
apiVersion: extensions/v1beta1
kind: Deployment
metadata:
  name: localhpatest
  labels:
    component: localhpatest
spec:
  replicas: 2
  selector:
    matchLabels:
      component: "localhpatest"
  template:
    metadata:
      labels:
        component: "localhpatest"
    spec:
      containers:
        - name: localhpatest
          image: "localhpatest:latest"
          imagePullPolicy: "Never"
          ports:
          - name: http
            containerPort: 8080
          resources:
            requests:
              cpu: "50m"
              memory: "64Mi"
            limits: 
              cpu: "100m"
              memory: "256Mi"
          livenessProbe:
            httpGet:
              path: /healthz
              port: http
            timeoutSeconds: 5
            initialDelaySeconds: 20
          readinessProbe:
            httpGet:
              path: /healthz
              port: http
            timeoutSeconds: 5
            initialDelaySeconds: 20
A quick examination and you’ll see that we added a Service, pointing to the localhpatest deployment via a component selector. We are exposing it on port 30080 and routing it to 8080 inside of the cluster. We also updated the Deployment to have 2 replicas. The service will randomly balance traffic to these 2 pods. Let’s run it and take a look.

> kubectl apply -f manifest.yml
service "localhpatest" created
deployment.extensions "localhpatest" configured
> kubectl get pods
NAME                            READY     STATUS    RESTARTS   AGE
localhpatest-7b4d9ffbcc-htnkj   1/1       Running   0          1m
localhpatest-7b4d9ffbcc-9fvd8   1/1       Running   0          20m
> kubectl get service
NAME           TYPE        CLUSTER-IP       EXTERNAL-IP   PORT(S)          AGE
kubernetes     ClusterIP   10.96.0.1        <none>        443/TCP          1h
localhpatest   NodePort    10.108.112.166   <none>        8080:30080/TCP   2m
As you see above, a new pod was added since we changed it to 2 replicas. Notice the age difference. We also have a new service routing 8080 to 30080. Try to hit http://localhost:30080 now via chrome.


You don’t notice it, but the service is randomly choosing one of the pods for you. Refresh chrome 20 times and look at the logs for each container.

> kubectl logs localhpatest-7b4d9ffbcc-htnkj
> localhpatest@1.0.0 start /usr/src/app
> node server.js
Running on http://0.0.0.0:8080
2666.5657689245168
3099.110033541888
2715.571394752861
2784.3983192065034
490.8288907552203
1448.2744905576428
2705.66553734936
2719.292555059128
1580.7975835001773
3030.0623755955917
1943.6951921533375
1696.9018828441438
> kubectl logs localhpatest-7b4d9ffbcc-9fvd8
> localhpatest@1.0.0 start /usr/src/app
> node server.js
Running on http://0.0.0.0:8080
2347.3335936760245
1160.448189278608
2131.0558415958976
2549.587613713245
2767.798764361311
3096.6909758643983
1875.464475803261
1014.5003696401495
2512.466318182196
2955.8866690047507
2630.3904653111863
2804.101282050989
Load test with Jmeter
Download apache jmeter 5.0: http://apache.mirrors.pair.com//jmeter/binaries/apache-jmeter-5.0.zip

Extract the zip and run /bin/jmeter.bat file to start up jmeter. Let’s create a test plan in jmeter

Give the test plan a name and save it somewhere you’ll know where to get to it.


Right click on the test plan and add a Thread Group. Threads > Thread Group. Give it 20 users, ramp up for 50 seconds, loop count for 100.


Right click on the Thread group and add Sampler > HTTP Request. Input localhost as the server and port 30080. Leave the rest as is.


Right click thread group again and add a few listeners.


Run it via the green play button and let’s look at some results


Throughput is 26.4 requests per second. Let’s scale it to 3 pods and see if we can increase it.

> kubectl scale deployment localhpatest --replicas=3
deployment.extensions "localhpatest" scaled
> kubectl get pods
NAME                            READY     STATUS    RESTARTS   AGE
localhpatest-7b4d9ffbcc-4pngl   1/1       Running   0          20s
localhpatest-7b4d9ffbcc-cd9tv   1/1       Running   0          20s
localhpatest-7b4d9ffbcc-htnkj   1/1       Running   0          37m
Clear the results in jmeter with the double broom icon at the top, middle right. Then run it again and look at the results.


Now the throughput is 31.7. Slightly better. Next let’s get it to autoscale!

Kubernetes HPA via heapster
Docker kubernetes cluster doesn’t come with heapster to monitor our pods so let’s install that first.

> kubectl create -f https://raw.githubusercontent.com/kubernetes/heapster/master/deploy/kube-config/influxdb/heapster.yaml
serviceaccount "heapster" created
deployment.extensions "heapster" created
service "heapster" created
//wait a minute here
> kubectl top pods
NAME                            CPU(cores)   MEMORY(bytes)
localhpatest-7b4d9ffbcc-4pngl   0m           31Mi
localhpatest-7b4d9ffbcc-cd9tv   0m           31Mi
localhpatest-7b4d9ffbcc-htnkj   0m           37Mi
localhpatest-7b4d9ffbcc-wfp8w   0m           54Mi
Now we have metrics for our pods using heapster. If you run the test again you should see some increased memory usage during the test. By default, heapster is only monitoring once a minute so don’t be surprised to have to wait a minute to get updated results. In a production environment I would recommend running prometheus with a metric rest API.

kubectl top pods
NAME                            CPU(cores)   MEMORY(bytes)
localhpatest-7b4d9ffbcc-4pngl   48m          52Mi
localhpatest-7b4d9ffbcc-cd9tv   47m          49Mi
localhpatest-7b4d9ffbcc-htnkj   57m          55Mi
localhpatest-7b4d9ffbcc-wfp8w   43m          55Mi
Let’s create a HPA. Update your manifest.yml again.

apiVersion: autoscaling/v2beta1
kind: HorizontalPodAutoscaler
metadata:
  name: localhpatest
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: localhpatest
  minReplicas: 2
  maxReplicas: 15
  metrics:
    - resource:
        name: cpu
        targetAverageUtilization: 100
      type: Resource
---
apiVersion: v1
kind: Service
metadata:
  name: localhpatest
  labels:
    component: localhpatest
spec:
  ports:
    - port: 8080
      nodePort: 30080
  selector:
    component: localhpatest
  type: "NodePort"
---
apiVersion: extensions/v1beta1
kind: Deployment
metadata:
  name: localhpatest
  labels:
    component: localhpatest
spec:
  replicas: 2
  selector:
    matchLabels:
      component: "localhpatest"
  template:
    metadata:
      labels:
        component: "localhpatest"
    spec:
      containers:
        - name: localhpatest
          image: "localhpatest:latest"
          imagePullPolicy: "Never"
          ports:
          - name: http
            containerPort: 8080
          resources:
            requests:
              cpu: "50m"
              memory: "64Mi"
            limits: 
              cpu: "100m"
              memory: "256Mi"
          livenessProbe:
            httpGet:
              path: /healthz
              port: http
            timeoutSeconds: 5
            initialDelaySeconds: 20
          readinessProbe:
            httpGet:
              path: /healthz
              port: http
            timeoutSeconds: 5
            initialDelaySeconds: 20
Apply the changes and check the HPA.

> kubectl apply -f manifest.yml
horizontalpodautoscaler.autoscaling "localhpatest" created
service "localhpatest" unchanged
deployment.extensions "localhpatest" configured
> kubectl get hpa
NAME           REFERENCE                 TARGETS          MINPODS   MAXPODS   REPLICAS   AGE
localhpatest   Deployment/localhpatest   <unknown>/100%   2         15        2          1m
You’ll notice that the HPA never seems to get results. If you describe the HPA you’ll see a problem.

> kubectl describe hpa
Name:                                                  localhpatest
Namespace:                                             default
Labels:                                                <none>
Annotations:                                           kubectl.kubernetes.io/last-applied-configuration={"apiVersion":"autoscaling/v2beta1","kind":"HorizontalPodAutoscaler","metadata":{"annotations":{},"name":"localhpatest","namespace":"default"},"spec":{...
CreationTimestamp:                                     Mon, 11 Feb 2019 10:19:16 -0600
Reference:                                             Deployment/localhpatest
Metrics:                                               ( current / target )
  resource cpu on pods  (as a percentage of request):  <unknown> / 100%
Min replicas:                                          2
Max replicas:                                          15
Conditions:
  Type           Status  Reason                   Message
  ----           ------  ------                   -------
  AbleToScale    True    SucceededGetScale        the HPA controller was able to get the target's current scale
  ScalingActive  False   FailedGetResourceMetric  the HPA was unable to compute the replica count: unable to get metrics for resource cpu: unable to fetch metrics from resource
metrics API: the server could not find the requested resource (get pods.metrics.k8s.io)
Events:
  Type     Reason                        Age               From                       Message
  ----     ------                        ----              ----                       -------
  Warning  FailedGetResourceMetric       14s (x3 over 1m)  horizontal-pod-autoscaler  unable to get metrics for resource cpu: unable to fetch metrics from resource metrics API:
the server could not find the requested resource (get pods.metrics.k8s.io)
  Warning  FailedComputeMetricsReplicas  14s (x3 over 1m)  horizontal-pod-autoscaler  failed to get cpu utilization: unable to get metrics for resource cpu: unable to fetch metrics from resource metrics API: the server could not find the requested resource (get pods.metrics.k8s.io)
unable to fetch metrics from resource metrics API: the server could not find the requested resource (get pods.metrics.k8s.io)

This is because the Docker for Windows install of kubernetes has rest api turned on by default. It will take a little hacking but we can fix that.

These are the 4 commands you’ll need. For a better explanation of what we’re doing here see https://blog.jongallant.com/2017/11/ssh-into-docker-vm-windows/

Get container with access to Docker Daemon. Run container with full root access. Switch to host file system.

docker run — privileged -it -v /var/run/docker.sock:/var/run/docker.sock jongallant/ubuntu-docker-client
docker run — net=host — ipc=host — uts=host — pid=host -it — security-opt=seccomp=unconfined — privileged — rm -v /:/host alpine /bin/sh
chroot /host
vi /etc/kubernetes/manifests/kube-controller-manager.yaml
> docker run --privileged -it -v /var/run/docker.sock:/var/run/docker.sock jongallant/ubuntu-docker-client
Unable to find image 'jongallant/ubuntu-docker-client:latest' locally
latest: Pulling from jongallant/ubuntu-docker-client
1be7f2b886e8: Already exists
6fbc4a21b806: Already exists
c71a6f8e1378: Already exists
4be3072e5a37: Already exists
06c6d2f59700: Already exists
39c46a020d9b: Pull complete
Digest: sha256:038874e2c9c663550c9ddb0c8eb814c88d8a264cd1a5bfb4305dec9282598094
Status: Downloaded newer image for jongallant/ubuntu-docker-client:latest
>root@48e36d0c580f:/# docker run --net=host --ipc=host --uts=host --pid=host -it --security-opt=seccomp=unconfined --privileged --rm -v /:/host alpine /bin/sh
Unable to find image 'alpine:latest' locally
latest: Pulling from library/alpine
6c40cc604d8e: Pull complete
Digest: sha256:b3dbf31b77fd99d9c08f780ce6f5282aba076d70a513a8be859d8d3a4d0c92b8
Status: Downloaded newer image for alpine:latest
/ # chroot /host
/ # vi /etc/kubernetes/manifests/kube-controller-manager.yaml
Edit the file with vim and add these lines under spec.containers.command (don’t blame me if you don’t know how to use vim, you can probably use nano as well)

- --horizontal-pod-autoscaler-use-rest-clients=false
    - --horizontal-pod-autoscaler-upscale-delay=0m30s
    - --horizontal-pod-autoscaler-downscale-delay=2m0s
    - --horizontal-pod-autoscaler-sync-period=0m10s
apiVersion: v1
kind: Pod
metadata:
  annotations:
    scheduler.alpha.kubernetes.io/critical-pod: ""
  creationTimestamp: null
  labels:
    component: kube-controller-manager
    tier: control-plane
  name: kube-controller-manager
  namespace: kube-system
spec:
  containers:
  - command:
    - kube-controller-manager
    - --address=127.0.0.1
    - --use-service-account-credentials=true
    - --service-account-private-key-file=/run/config/pki/sa.key
    - --cluster-signing-key-file=/run/config/pki/ca.key
    - --leader-elect=true
    - --controllers=*,bootstrapsigner,tokencleaner
    - --kubeconfig=/etc/kubernetes/controller-manager.conf
    - --root-ca-file=/run/config/pki/ca.crt
    - --cluster-signing-cert-file=/run/config/pki/ca.crt
    - --horizontal-pod-autoscaler-use-rest-clients=false
    - --horizontal-pod-autoscaler-upscale-delay=0m30s
    - --horizontal-pod-autoscaler-downscale-delay=2m0s
    - --horizontal-pod-autoscaler-sync-period=0m10s
    image: k8s.gcr.io/kube-controller-manager-amd64:v1.10.3
    livenessProbe:
      failureThreshold: 8
vi assist: <esc> then ‘:wq’ + enter to save the file. Type exit + enter 3 times to get back to your original command prompt.

When you save the file, kube controller will automatically restart, wait a couple of minute and check your HPA again. You should see targets now, something like below.

> kubectl get hpa
NAME           REFERENCE                 TARGETS   MINPODS   MAXPODS   REPLICAS   AGE
localhpatest   Deployment/localhpatest   0%/100%   2         15        2          18m
We should be good to go for autoscaling now. Let’s run a much longer and heavier test and monitor some activity. In the thread group in jmeter, let’s set the following settings. 40,100,1000


Clear the previous results and run it again. Keep an eye on it, we will run some commands to monitor the autoscaling as it runs.

After clicking run, wait a minute and run kubectl top pods and the kubectl get hpa.

> kubectl top pods
NAME                            CPU(cores)   MEMORY(bytes)
localhpatest-7b4d9ffbcc-htnkj   37m          53Mi
localhpatest-7b4d9ffbcc-wfp8w   51m          54Mi
> kubectl get hpa
NAME           REFERENCE                 TARGETS    MINPODS   MAXPODS   REPLICAS   AGE
localhpatest   Deployment/localhpatest   88%/100%   2         15        2          24m
It hasn’t scaled up yet. Let’s check at 2 minutes.

> kubectl top pods
NAME                            CPU(cores)   MEMORY(bytes)
localhpatest-7b4d9ffbcc-htnkj   97m          64Mi
localhpatest-7b4d9ffbcc-wfp8w   91m          70Mi
> kubectl get hpa
NAME           REFERENCE                 TARGETS     MINPODS   MAXPODS   REPLICAS   AGE
localhpatest   Deployment/localhpatest   188%/100%   2         15        4          25m
> kubectl get pods
NAME                            READY     STATUS    RESTARTS   AGE
localhpatest-7b4d9ffbcc-6kpxl   1/1       Running   0          34s
localhpatest-7b4d9ffbcc-h6879   1/1       Running   0          34s
localhpatest-7b4d9ffbcc-htnkj   1/1       Running   0          1h
localhpatest-7b4d9ffbcc-wfp8w   1/1       Running   0          1h
Awesome! It scaled up to handle the load. Let’s check again at 4 minutes.

> kubectl get hpa
NAME           REFERENCE                 TARGETS     MINPODS   MAXPODS   REPLICAS   AGE
localhpatest   Deployment/localhpatest   186%/100%   2         15        8          27m
> kubectl get pods
NAME                            READY     STATUS    RESTARTS   AGE
localhpatest-7b4d9ffbcc-2ksvk   1/1       Running   0          28s
localhpatest-7b4d9ffbcc-2rrzt   1/1       Running   0          29s
localhpatest-7b4d9ffbcc-6kpxl   1/1       Running   0          2m
localhpatest-7b4d9ffbcc-h6879   1/1       Running   0          2m
localhpatest-7b4d9ffbcc-htnkj   1/1       Running   0          1h
localhpatest-7b4d9ffbcc-kskqn   1/1       Running   0          29s
localhpatest-7b4d9ffbcc-mvpk5   1/1       Running   0          29s
localhpatest-7b4d9ffbcc-wfp8w   1/1       Running   0          1h
It scaled up to 8 pods. Check again at 6 minutes.

> kubectl get hpa
NAME           REFERENCE                 TARGETS     MINPODS   MAXPODS   REPLICAS   AGE
localhpatest   Deployment/localhpatest   170%/100%   2         15        14         29m
> kubectl get pods
NAME                            READY     STATUS    RESTARTS   AGE
localhpatest-7b4d9ffbcc-2ksvk   1/1       Running   0          2m
localhpatest-7b4d9ffbcc-2rrzt   1/1       Running   0          2m
localhpatest-7b4d9ffbcc-6kpxl   1/1       Running   0          4m
localhpatest-7b4d9ffbcc-fxpkf   1/1       Running   0          50s
localhpatest-7b4d9ffbcc-h25w5   1/1       Running   0          50s
localhpatest-7b4d9ffbcc-h6879   1/1       Running   0          4m
localhpatest-7b4d9ffbcc-hfsmz   1/1       Running   0          50s
localhpatest-7b4d9ffbcc-htnkj   1/1       Running   0          1h
localhpatest-7b4d9ffbcc-kskqn   1/1       Running   0          2m
localhpatest-7b4d9ffbcc-mvpk5   1/1       Running   0          2m
localhpatest-7b4d9ffbcc-rbpcc   1/1       Running   0          49s
localhpatest-7b4d9ffbcc-wfp8w   1/1       Running   0          1h
localhpatest-7b4d9ffbcc-xbfjb   1/1       Running   0          49s
localhpatest-7b4d9ffbcc-z7bxm   1/1       Running   0          49s
14 pods! let’s check kubectl top pods.

> kubectl top pods
NAME                            CPU(cores)   MEMORY(bytes)
localhpatest-7b4d9ffbcc-2ksvk   58m          44Mi
localhpatest-7b4d9ffbcc-2rrzt   67m          46Mi
localhpatest-7b4d9ffbcc-6kpxl   59m          45Mi
localhpatest-7b4d9ffbcc-fxpkf   64m          37Mi
localhpatest-7b4d9ffbcc-h25w5   62m          37Mi
localhpatest-7b4d9ffbcc-h6879   61m          45Mi
localhpatest-7b4d9ffbcc-hfsmz   65m          45Mi
localhpatest-7b4d9ffbcc-htnkj   62m          45Mi
localhpatest-7b4d9ffbcc-kskqn   62m          46Mi
localhpatest-7b4d9ffbcc-mvpk5   61m          45Mi
localhpatest-7b4d9ffbcc-rbpcc   62m          34Mi
localhpatest-7b4d9ffbcc-wfp8w   60m          48Mi
localhpatest-7b4d9ffbcc-xbfjb   70m          39Mi
localhpatest-7b4d9ffbcc-z7bxm   60m          39Mi
On my machine, the test stops around 7.5 minutes. Let’s wait a couple of minutes and observe kubernetes downscaling the deployment.

> kubectl get hpa
NAME           REFERENCE                 TARGETS    MINPODS   MAXPODS   REPLICAS   AGE
localhpatest   Deployment/localhpatest   15%/100%   2         15        15         32m
> kubectl get hpa
NAME           REFERENCE                 TARGETS   MINPODS   MAXPODS   REPLICAS   AGE
localhpatest   Deployment/localhpatest   0%/100%   2         15        15         33m
> kubectl get hpa
NAME           REFERENCE                 TARGETS   MINPODS   MAXPODS   REPLICAS   AGE
localhpatest   Deployment/localhpatest   0%/100%   2         15        2          34m
> kubectl get pods
NAME                            READY     STATUS    RESTARTS   AGE
localhpatest-7b4d9ffbcc-htnkj   1/1       Running   0          1h
localhpatest-7b4d9ffbcc-wfp8w   1/1       Running   0          1h
Now you have a deployment that will scale under load! If you get brave play around with the load test and see how well you can scale your app.

Finally for a little clean up. With kubectl you can easily delete everything that was created. Happy ctl-ing!

> kubectl delete -f manifest.yml
horizontalpodautoscaler.autoscaling "localhpatest" deleted
service "localhpatest" deleted
deployment.extensions "localhpatest" deleted
