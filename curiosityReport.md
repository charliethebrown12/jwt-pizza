# **Curiosity Report: Automating Home Container Updates with Watchtower**

## **1\. Introduction**

In our course, we learned about pipelines where changes are pushed from a repository to a server. However, managing always active containers on physical hardware (like my personal Synology NAS) presents a different challenge: **Container Drift**.

I rely on a home media server (including tools like Tautulli and Komga) running via Docker. The problem is that updating these containers requires me to manually stop the container, pull the new image, and recreate it with the exact same arguments. I often don't even know if there are updates as I don't manually check the containers often enough to see if there are updates to be made as the process is tedious..

My curiosity experiment was to implement a continuously automated updating tool called [Watchtower](https://containrrr.dev/watchtower/).

## **2\. The Experiment**

Watchtower is a container that monitors other containers. It detects when a new image is pushed to the registry, pulls it, and gracefully restarts the application with the original configuration.

To implement this, I had to solve a specific permission challenge. Watchtower needs to send commands to the Docker Daemon on the host machine. I accomplished this by mounting the host's Docker socket (/var/run/docker.sock) into the Watchtower container.

### **Implementation**

I accessed my Synology NAS via SSH and executed the following command:

Bash

sudo docker run -d \\

\--name watchtower \\

\-v /var/run/docker.sock:/var/run/docker.sock \\

containrrr/watchtower \\

\--interval 3600

**Breakdown of the command:**

- \-v /var/run/docker.sock:/var/run/docker.sock: This is the critical piece. It creates the "mount" that exposes the NAS's Docker API to the container. This grants Watchtower the authority to stop and start other containers.
- \--interval 3600: This configures the polling frequency to every hour (3600 seconds).

### **Verification**

I verified the installation by inspecting the logs (sudo docker logs watchtower). The output confirmed that the scheduler found updates for three of my containers (komf, komga, and tautulli) and performed a "rolling restart" without any manual intervention:

time="2025-11-23T23:36:58Z" level=info msg="Found new gotson/komga:latest image (200d191d26e1)"

time="2025-11-23T23:37:25Z" level=info msg="Found new tautulli/tautulli:latest image (1b1fd32fc9f7)"

time="2025-11-23T23:37:25Z" level=info msg="Stopping /tautulli (cec36c690c78) with SIGTERM"

time="2025-11-23T23:37:40Z" level=info msg="Stopping /komga (23da1e8e14a6) with SIGTERM"

time="2025-11-23T23:38:26Z" level=info msg="Creating /komga"

time="2025-11-23T23:38:39Z" level=info msg="Creating /tautulli"

time="2025-11-23T23:38:53Z" level=info msg="Session done" Failed=0 Scanned=4 Updated=3 notify=no

## **3\. DevOps Connection**

This experiment reinforced several key DevOps concepts:

- **Pull-Based Deployment:** Unlike the Push-based deployments (GitHub Actions) we used in class, Watchtower uses a Pull-based model. The agent sits inside the infrastructure and polls the registry for state changes.
- **Infrastructure as Code:** By defining the update logic in a container, I removed the need for manual server administration.
- **Security Trade-offs:** Mounting the Docker socket is powerful but dangerous. It effectively gives the container root access to the host daemon. In a professional environment, I learned that we would likely use a secured TCP socket or restrict the scope of the container to mitigate this risk.

## **4\. Conclusion**

By implementing Watchtower, I successfully automated the maintenance of my home server containers. This dive gave me practical experience with volume mapping for system control rather than just data storage, broadening my understanding of how Docker interacts with the host OS.
