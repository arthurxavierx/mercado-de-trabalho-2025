import aiortc
import argparse
import asyncio
import contextlib
import ean13
import json
import logging
import json
import socket
import ssl
import sys

from aiohttp import web
from aiohttp_index import IndexMiddleware
from aiortc import RTCDataChannel, RTCPeerConnection, RTCSessionDescription
from dataclasses import asdict, dataclass
from functools import partial
from pythonosc.dispatcher import Dispatcher
from pythonosc.osc_server import AsyncIOOSCUDPServer
from pythonosc.udp_client import SimpleUDPClient

barcodes = {}
notes = {}
peer_count = 0
peers = {}

logger = logging.getLogger("peer")

@dataclass
class Barcode:
    barcode: str
    note: int
    name: str
    age: str
    profession: str

# We choose to receive an OSC message from Max For Live instead of just sending
# back to the client all the received barcodes with the associated data, so that
# we can control in Ableton Live whether to send these messages or not with
# automation.
def on_midi(address: str, note: int, velocity: int) -> None:
    print(f"> {address}: {note}, {velocity}")
    parts = address.split("/", 2)
    peer_id = int(parts[1])
    if peer_id in peers and peers[peer_id]["channel"] is not None:
        with contextlib.suppress(aiortc.exceptions.InvalidStateError):
            if note in notes and velocity > 0:
                dict = asdict(notes[note])
                dict["velocity"] = velocity
                peers[peer_id]["channel"].send(json.dumps(dict))
                print(f"< {peer_id}: {dict["barcode"]}, {dict["velocity"]}")

async def on_offer(client, request):
    global peer_count

    params = await request.json()
    offer = RTCSessionDescription(sdp=params["sdp"], type=params["type"])

    peer = RTCPeerConnection()
    peer_count = peer_count + 1
    peer_id = peer_count
    peers[peer_id] = { "peer": peer, "channel": None }

    def log_info(msg, *args):
        logger.info(f"{peer_id} {msg % tuple(args)}")

    log_info("Created for %s", request.remote)

    @peer.on("datachannel")
    def on_datachannel(channel):
        log_info("Datachannel %s received", channel.id)
        peers[peer_id]["channel"] = channel
        @channel.on("message")
        def on_message(message):
            (format, barcode) = tuple(message.split(' ', 2))
            if barcode in barcodes:
                data = barcodes[barcode]
                midi = [data.note, 127]
                client.send_message(f"/note", midi)
                print(f"< /note: {midi}")

    @peer.on("connectionstatechange")
    async def on_connectionstatechange():
        log_info("Connection state is %s", peer.connectionState)
        if peer.connectionState == "failed":
            await peer.close()
            del peers[peer_id]

    await peer.setRemoteDescription(offer)
    await peer.setLocalDescription(await peer.createAnswer())

    return web.Response(
        content_type="application/json",
        text=json.dumps({ "sdp": peer.localDescription.sdp, "type": peer.localDescription.type }),
    )

async def on_shutdown(app):
    coros = [peers[peer_id]["peer"].close() for peer_id in peers]
    await asyncio.gather(*coros)
    peers.clear()

async def run_osc_server(host, port, _app):
    dispatcher = Dispatcher()
    dispatcher.map("/*/midi", on_midi)

    server = AsyncIOOSCUDPServer((host, port), dispatcher, asyncio.get_event_loop())
    task = asyncio.create_task(server.create_serve_endpoint())

    yield

    task.cancel()
    with contextlib.suppress(asyncio.CancelledError):
        transport, protocol = await task

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="WebRTC audio / video / data-channels demo")
    parser.add_argument("--cert-file", help="SSL certificate file (for HTTPS)")
    parser.add_argument("--key-file", help="SSL key file (for HTTPS)")
    parser.add_argument("--host", default="0.0.0.0", help="Host for HTTP server (default: 0.0.0.0)")
    parser.add_argument("--port", type=int, default=8080, help="Port for HTTP server (default: 8080)")
    parser.add_argument("--udpport", type=int, default=9999, help="Port for the UDP socket (default: 9999)")
    parser.add_argument("--verbose", "-v", action="count")
    args = parser.parse_args()

    if args.verbose:
        logging.basicConfig(level=logging.DEBUG)
    else:
        logging.basicConfig(level=logging.INFO)

    if args.cert_file:
        ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        ssl_context.load_cert_chain(args.cert_file, args.key_file)
    else:
        ssl_context = None

    for line in sys.stdin:
        unchecked_code, note, name, age, profession = line.split(',')
        barcode = Barcode(ean13.check(unchecked_code), int(note), name, int(age), profession)
        barcodes[barcode.barcode] = barcode
        notes[barcode.note] = barcode

    client = SimpleUDPClient(args.host, args.udpport)
    app = web.Application(middlewares=[IndexMiddleware()])
    app.on_shutdown.append(on_shutdown)
    app.router.add_post("/offer", partial(on_offer, client))
    app.router.add_static("/", path="./static/")
    app.cleanup_ctx.append(partial(run_osc_server, args.host, args.udpport - 1))

    print(socket.gethostbyname_ex(socket.gethostname())[-1])
    web.run_app(app, host=args.host, port=args.port, ssl_context=ssl_context)
