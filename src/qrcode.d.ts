declare module "qrcode" {
  const QRCode: {
    toString(
      text: string,
      options?: {
        type?: "svg" | "utf8";
        margin?: number;
        color?: { dark?: string; light?: string };
      },
    ): Promise<string>;
  };
  export default QRCode;
}
