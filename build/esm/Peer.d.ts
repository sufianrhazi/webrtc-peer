export declare class Peer {
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
    constructor(handler: (toSend: string) => Promise<string>, options?: RTCConfiguration);
    connected(): Promise<void>;
    onMessage(handler: (event: MessageEvent<any>) => void): void;
    start(): Promise<void>;
    addMedia(constraints: MediaStreamConstraints): Promise<void>;
    accept(encodedOffer: string): Promise<void>;
}
