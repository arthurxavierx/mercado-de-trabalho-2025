class DataChannel {

  constructor() {
    this.peer = new RTCPeerConnection();
    this.channel = this.peer.createDataChannel('data', { ordered: true });
    this.channel.addEventListener('open', () => this.onopen());
    this.channel.addEventListener('close', () => this.onclose());
    this.channel.addEventListener('message', (event) => this.onmessage(event));
  }

  async connect() {
    const offer = await this.peer.createOffer();
    await this.peer.setLocalDescription(offer);

    await new Promise((resolve) => {
      if (this.peer.iceGatheringState === 'complete') {
        resolve();
      }
      else {
        const checkState = () => {
          if (this.peer.iceGatheringState === 'complete') {
            this.peer.removeEventListener('icegatheringstatechange', checkState);
            resolve();
          }
        }
        this.peer.addEventListener('icegatheringstatechange', checkState);
      }
    });

    const response = await fetch('/offer', {
      body: JSON.stringify({ sdp: this.peer.localDescription.sdp, type: this.peer.localDescription.type }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST'
    });
    return this.peer.setRemoteDescription(await response.json());
  }

  async close() {
    return Promise.all([this.channel.close(), this.peer.close()]);
  }

  send(buffer) {
    this.channel.send(buffer);
  }

  async onChannelOpen() {
  }

  async onChannelClose() {
  }

  async onmessage() {
  }
}
