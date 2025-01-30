#pragma once

#include <oqs/oqs.h>
#include <openssl/crypto.h>
#include <memory>
#include <string>
#include "memory.h"

namespace quantum
{

    // Forward declarations
    class Buffer;
    class PrivateKey;
    class PublicKey;
    class Signature;
    class SharedSecret;

    // Exception class for quantum-related errors
    class QuantumError : public std::runtime_error
    {
    public:
        explicit QuantumError(const std::string &msg) : std::runtime_error(msg) {}
    };

    // Security parameters structure
    struct SecurityParams
    {
        static const SecurityParams DEFAULT;
        uint32_t entropyQuality{256}; // Bits of entropy required
        uint32_t securityLevel{256};  // Security level in bits
        bool sidechannelProtection{true};
    };

    // Key pair structure
    struct KeyPair
    {
        Buffer publicKey;
        Buffer privateKey;
    };

    // Kyber encapsulation result structure
    struct KyberResult
    {
        Buffer ciphertext;
        Buffer sharedSecret;
    };

    // QuantumCrypto class managing quantum-resistant cryptographic operations
    class QuantumCrypto
    {
    public:
        // Singleton access
        static QuantumCrypto &getInstance(const SecurityParams &params = SecurityParams::DEFAULT);

        // Delete copy constructor and assignment operator
        QuantumCrypto(const QuantumCrypto &) = delete;
        QuantumCrypto &operator=(const QuantumCrypto &) = delete;

        // Destructor
        ~QuantumCrypto();

        // Core cryptographic operations
        KeyPair generateDilithiumKeyPair();
        KeyPair generateKyberKeyPair();

        // Signing operations
        Signature sign(const Buffer &message, const PrivateKey &key) const;
        bool verify(const Buffer &message, const Signature &signature, const PublicKey &key) const;

        // KEM operations
        KyberResult kyberEncapsulate(const PublicKey &key);
        SharedSecret kyberDecapsulate(const Buffer &ciphertext, const PrivateKey &key);

        // Random number generation
        Buffer generateSecureRandom(size_t length) const;

        // Health and security monitoring
        bool healthCheck();
        void validateSecurityLevel() const;
        void checkForSideChannels() const;

    private:
        // Private constructor for singleton
        QuantumCrypto();

        // PIMPL idiom
        struct Implementation;
        std::unique_ptr<Implementation> pImpl;

        // Internal methods
        void monitorEntropy();
        void initializeSecurityMonitor();
    };

    // Buffer classes with secure memory handling

    // Base Buffer class inheriting from SecureBuffer<uint8_t>
    class Buffer : public SecureBuffer<uint8_t>
    {
    public:
        explicit Buffer(size_t size);
        Buffer(const uint8_t *data, size_t size);

        // Convert buffer to Base64 string
        std::string toBase64() const;

        // Create Buffer from Base64 string
        static Buffer fromBase64(const std::string &base64);

        // Secure zeroing
        void zeroize();
    };

    // PrivateKey class inheriting from Buffer
    class PrivateKey : public Buffer
    {
    public:
        using Buffer::Buffer;

        void zeroize();
    };

    // PublicKey class inheriting from Buffer
    class PublicKey : public Buffer
    {
    public:
        using Buffer::Buffer;

        // Generate fingerprint using SHA-256
        std::string getFingerprint() const;
    };

    // Signature class inheriting from Buffer
    class Signature : public Buffer
    {
    public:
        using Buffer::Buffer;

        // Check if the signature is valid
        bool isValid() const;
    };

    // SharedSecret class inheriting from Buffer
    class SharedSecret : public Buffer
    {
    public:
        using Buffer::Buffer;

        void zeroize();
    };

} // namespace quantum