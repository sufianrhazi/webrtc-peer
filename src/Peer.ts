/**
 * Utility functions
 */
function assert<T>(
    pred: T,
    msg: string = 'Invariant violated',
    ...extra: any[]
): asserts pred {
    if (!pred) {
        console.error(`Assertion Error: ${msg}`, ...extra);
        throw new Error(`Assertion Error: ${msg}`);
    }
}

function makePromise<T>() {
    let resolve: undefined | ((val: T) => void);
    let reject: undefined | ((err: any) => void);
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    assert(resolve);
    assert(reject);
    return { promise, resolve, reject };
}

/**
 * Data structure checking
 */

type Check<T> = (val: unknown) => val is T;
type CheckType<V> = V extends Check<infer A> ? A : never;

const isString: Check<string> = (val): val is string => typeof val === 'string';

function isExact<const T>(constant: T): (val: unknown) => val is T {
    return (val: unknown): val is T => val === constant;
}

function isArray<T>(check: Check<T>): (val: unknown) => val is T[] {
    return (val: unknown): val is T[] => {
        return Array.isArray(val) && val.every((item) => check(item));
    };
}

function isShape<T extends Record<string, Check<any>>>(
    shape: T
): Check<{ [Key in keyof T]: CheckType<T[Key]> }> {
    return (val: unknown): val is { [Key in keyof T]: CheckType<T[Key]> } => {
        if (typeof val !== 'object') {
            return false;
        }
        if (!val) {
            return false;
        }
        for (const [key, check] of Object.entries(shape)) {
            if (!(key in val)) {
                return false;
            }
            if (!check((val as any)[key])) {
                return false;
            }
        }
        return true;
    };
}

// Server: create offer
// Client: accept offer and create answer
// Server: accept answer
const isOffer = isShape({
    type: isExact('offer'),
    sdp: isString,
});

const isAnswer = isShape({
    type: isExact('answer'),
    sdp: isString,
});

const isCandidateList = isArray(
    isShape({
        candidate: isString,
    })
);

const isNegotiateOffer = isShape({
    type: isExact('negotiateOffer'),
    offer: isOffer,
    candidates: isCandidateList,
});

const isNegotiateAnswer = isShape({
    type: isExact('negotiateAnswer'),
    answer: isAnswer,
    candidates: isCandidateList,
});

function encodeNegotiateOffer(
    negotiateOffer: RTCSessionDescriptionInit,
    iceCandidates: RTCIceCandidate[]
): string {
    return btoa(
        JSON.stringify({
            type: 'negotiateOffer',
            offer: negotiateOffer,
            candidates: iceCandidates,
        })
    );
}

function decodeNegotiateOffer(encoded: string) {
    let decoded: unknown;
    try {
        decoded = JSON.parse(atob(encoded));
    } catch (e) {
        throw new Error(
            `Failed decoding offer: ${e instanceof Error ? e.message : 'unknown error'}`
        );
    }
    assert(
        isNegotiateOffer(decoded),
        'Failed decoding offer: unexpected decoded result'
    );
    return decoded;
}

function encodeNegotiateAnswer(
    negotiateAnswer: RTCSessionDescriptionInit,
    iceCandidates: RTCIceCandidate[]
): string {
    return btoa(
        JSON.stringify({
            type: 'negotiateAnswer',
            answer: negotiateAnswer,
            candidates: iceCandidates,
        })
    );
}

function decodeNegotiateAnswer(encoded: string) {
    let decoded: unknown;
    try {
        decoded = JSON.parse(atob(encoded));
    } catch (e) {
        const msg = `Failed decoding answer: ${e instanceof Error ? e.message : 'unknown error'}`;
        console.error(msg, e);
        throw new Error(msg);
    }
    assert(
        isNegotiateAnswer(decoded),
        'Failed decoding answer: unexpected decoded result'
    );
    return decoded;
}

export class Peer {
    handler: (toSend: string) => Promise<string>;
    channel: RTCDataChannel | undefined;
    onMessageHandler: undefined | ((event: MessageEvent<any>) => void);

    peerConnection: RTCPeerConnection;

    iceCandidates: RTCIceCandidate[];
    iceCandidatesPromise: {
        promise: Promise<RTCIceCandidate[]>;
        resolve: (candidates: RTCIceCandidate[]) => void;
        reject: (error: any) => void;
    };
    connectedPromise: {
        promise: Promise<void>;
        resolve: () => void;
        reject: (error: any) => void;
    };

    constructor(
        handler: (toSend: string) => Promise<string>,
        options: RTCConfiguration = {
            // Note: abstract.properties:3478 is my personal STUN server, it is subject to change/disappear in the future
            iceServers: [{ urls: 'stun:abstract.properties:3478' }],
        }
    ) {
        this.handler = handler;
        this.peerConnection = new RTCPeerConnection(options);
        this.channel = undefined;

        this.iceCandidatesPromise = makePromise<RTCIceCandidate[]>();
        this.connectedPromise = makePromise<void>();

        this.iceCandidates = [];
        this.peerConnection.addEventListener('connectionstatechange', (e) => {
            console.log(
                'client connectionstatechange',
                this.peerConnection.connectionState
            );
            if (this.peerConnection.connectionState === 'connected') {
                this.connectedPromise.resolve();
            } else if (this.peerConnection.connectionState === 'failed') {
                this.connectedPromise.reject(new Error('Unable to connect'));
            }
        });
        this.peerConnection.addEventListener('icecandidate', (e) => {
            console.log('client icecandidate', e.candidate);
            if (e.candidate) {
                this.iceCandidates.push(e.candidate);
            }
        });
        this.peerConnection.addEventListener('icegatheringstatechange', (e) => {
            console.log(
                'client icegatheringstatechange',
                this.peerConnection.iceGatheringState
            );
            if (this.peerConnection.iceGatheringState === 'complete') {
                if (this.iceCandidates.length > 0) {
                    this.iceCandidatesPromise.resolve(this.iceCandidates);
                } else {
                    this.iceCandidatesPromise.reject(
                        new Error('No ICE Candidates found')
                    );
                }
            }
        });
        this.peerConnection.addEventListener('datachannel', (e) => {
            console.log('client datachannel', e.channel);
            assert(!this.channel, 'got multiple channels!');
            this.channel = e.channel;
            if (this.onMessageHandler) {
                this.channel.addEventListener('message', this.onMessageHandler);
            }
        });
        this.peerConnection.addEventListener(
            'negotiationneeded',
            async (event) => {
                console.log('client negotiationneeded');
                const offer = await this.peerConnection.createOffer();
                this.peerConnection.setLocalDescription(
                    new RTCSessionDescription(offer)
                );

                const iceCandidates = await this.iceCandidatesPromise.promise;
                const { answer, candidates: remoteCandidates } =
                    decodeNegotiateAnswer(
                        await this.handler(
                            encodeNegotiateOffer(offer, iceCandidates)
                        )
                    );
                this.peerConnection.setRemoteDescription(
                    new RTCSessionDescription(answer)
                );

                for (const candidate of remoteCandidates) {
                    this.peerConnection.addIceCandidate(candidate);
                }
                this.peerConnection.addIceCandidate();
            }
        );
    }

    connected(): Promise<void> {
        return this.connectedPromise.promise;
    }

    onMessage(handler: (event: MessageEvent<any>) => void) {
        this.channel?.addEventListener('message', handler);
        this.onMessageHandler = handler;
    }

    async start() {
        this.channel = this.peerConnection.createDataChannel('main');
        if (this.onMessageHandler) {
            this.channel.addEventListener('message', this.onMessageHandler);
        }
    }

    async addMedia(constraints: MediaStreamConstraints) {
        const localStream =
            await navigator.mediaDevices.getUserMedia(constraints);
        for (const track of localStream.getTracks()) {
            this.peerConnection.addTrack(track, localStream);
        }
    }

    async accept(encodedOffer: string) {
        const { offer, candidates: remoteCandidates } =
            decodeNegotiateOffer(encodedOffer);
        await this.peerConnection.setRemoteDescription(
            new RTCSessionDescription(offer)
        );
        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(
            new RTCSessionDescription(answer)
        );
        for (const candidate of remoteCandidates) {
            this.peerConnection.addIceCandidate(candidate);
        }
        this.peerConnection.addIceCandidate();
        const iceCandidates = await this.iceCandidatesPromise.promise;

        this.accept(
            await this.handler(encodeNegotiateAnswer(answer, iceCandidates))
        );
    }
}
