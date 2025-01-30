#include "quantum.h"
#include "memory.h"
#include <openssl/rand.h>
#include <openssl/err.h>
#include "security_monitor.h"
#include <stdexcept>
#include <mutex>
#include "entropy_pool.h"
#include <oqs/oqs.h>

namespace quantum
{

    // Implementation struct for PIMPL idiom
    struct QuantumCrypto::Implementation
    {
        std::mutex mutex;
        std::unique_ptr<OQS_SIG, decltype(&OQS_SIG_free)> dilithium;
        std::unique_ptr<OQS_KEM, decltype(&OQS_KEM_free)> kyber;
        SecurityMonitor monitor;
        EntropyPool entropy;

        Implementation()
            : dilithium(OQS_SIG_new(OQS_SIG_alg_dilithium_5), OQS_SIG_free),
              kyber(OQS_KEM_new(OQS_KEM_alg_kyber_1024), OQS_KEM_free)
        {
            if (!dilithium || !kyber)
            {
                throw QuantumError("Failed to initialize quantum algorithms");
            }
        }

        ~Implementation()
        {
            // unique_ptr automatically frees resources
            /*
            This is empty because std::unique_ptr handles the
            deallocation of its managed objects automatically.
            This ensures that all resources are properly freed without manual intervention.
            */
        }
    };

    // Destructor implementation for QuantumCrypto
    QuantumCrypto::~QuantumCrypto() = default;

    // Singleton access
    QuantumCrypto &QuantumCrypto::getInstance(const SecurityParams &params)
    {
        static QuantumCrypto instance;
        return instance;
    }

    // Private constructor
    QuantumCrypto::QuantumCrypto()
        : pImpl(std::make_unique<Implementation>())
    {
        initializeSecurityMonitor();
    }

    // Generate Dilithium Key Pair
    KeyPair QuantumCrypto::generateDilithiumKeyPair()
    {
        std::lock_guard<std::mutex> lock(pImpl->mutex);

        try
        {
            validateSecurityLevel();
            monitorEntropy();

            SecureBuffer<uint8_t> publicKey(pImpl->dilithium->length_public_key);
            SecureBuffer<uint8_t> privateKey(pImpl->dilithium->length_secret_key);
            SecureBuffer<uint8_t> entropyBytes(32);
            std::vector<uint8_t> temp = pImpl->entropy.getBytes(32);
            std::memcpy(entropyBytes.data(), temp.data(), 32);

            int status = OQS_SIG_keypair(
                pImpl->dilithium.get(),
                publicKey.data(),
                privateKey.data());

            if (status != OQS_SUCCESS)
            {
                throw QuantumError("Dilithium key generation failed");
            }

            return KeyPair{
                Buffer(publicKey.data(), publicKey.size()),
                PrivateKey(privateKey.data(), privateKey.size())};
        }
        catch (const std::exception &e)
        {
            pImpl->monitor.logFailure("Dilithium Key Generation", e.what());
            throw;
        }
    }

    // Generate Kyber Key Pair
    KeyPair QuantumCrypto::generateKyberKeyPair()
    {
        std::lock_guard<std::mutex> lock(pImpl->mutex);

        try
        {
            validateSecurityLevel();
            monitorEntropy();

            SecureBuffer<uint8_t> publicKey(pImpl->kyber->length_public_key);
            SecureBuffer<uint8_t> privateKey(pImpl->kyber->length_secret_key);

            int status = OQS_KEM_keypair(
                pImpl->kyber.get(),
                publicKey.data(),
                privateKey.data());

            if (status != OQS_SUCCESS)
            {
                throw QuantumError("Kyber key generation failed");
            }

            return KeyPair{
                Buffer(publicKey.data(), publicKey.size()),
                PrivateKey(privateKey.data(), privateKey.size())};
        }
        catch (const std::exception &e)
        {
            pImpl->monitor.logFailure("Kyber Key Generation", e.what());
            throw;
        }
    }

    // Signing operation
    Signature QuantumCrypto::sign(const Buffer &message, const PrivateKey &key) const
    {
        std::lock_guard<std::mutex> lock(pImpl->mutex);

        try
        {
            validateSecurityLevel();

            SecureBuffer<uint8_t> signature(pImpl->dilithium->length_signature);
            size_t sigLen;

            int status = OQS_SIG_sign(
                pImpl->dilithium.get(),
                signature.data(),
                &sigLen,
                message.data(),
                message.size(),
                key.data());

            if (status != OQS_SUCCESS)
            {
                throw QuantumError("Signing failed");
            }

            return Signature(signature.data(), sigLen);
        }
        catch (const std::exception &e)
        {
            pImpl->monitor.logFailure("Signing", e.what());
            throw;
        }
    }

    // Verification operation
    bool QuantumCrypto::verify(const Buffer &message, const Signature &signature, const PublicKey &key) const
    {
        std::lock_guard<std::mutex> lock(pImpl->mutex);

        try
        {
            validateSecurityLevel();

            // Ensure that the signature size matches the expected length
            if (signature.size() != pImpl->dilithium->length_signature)
            {
                pImpl->monitor.logFailure("Verify", "Signature length mismatch");
                return false;
            }

            // Perform signature verification using OQS_SIG_verify
            int status = OQS_SIG_verify(
                pImpl->dilithium.get(),
                message.data(),
                message.size(),
                signature.data(),
                signature.size(),
                key.data());

            if (status != OQS_SUCCESS)
            {
                pImpl->monitor.logFailure("Verify", "Signature verification failed");
                return false;
            }

            return true;
        }
        catch (const std::exception &e)
        {
            pImpl->monitor.logFailure("Verify", e.what());
            throw;
        }
    }

    // Kyber Encapsulation
    KyberResult QuantumCrypto::kyberEncapsulate(const PublicKey &key)
    {
        std::lock_guard<std::mutex> lock(pImpl->mutex);

        try
        {
            validateSecurityLevel();

            SecureBuffer<uint8_t> ciphertext(pImpl->kyber->length_ciphertext);
            SecureBuffer<uint8_t> sharedSecret(pImpl->kyber->length_shared_secret);

            int status = OQS_KEM_encaps(
                pImpl->kyber.get(),
                ciphertext.data(),
                sharedSecret.data(),
                key.data());

            if (status != OQS_SUCCESS)
            {
                throw QuantumError("Kyber encapsulation failed");
            }

            return KyberResult{
                Buffer(ciphertext.data(), ciphertext.size()),
                SharedSecret(sharedSecret.data(), sharedSecret.size())};
        }
        catch (const std::exception &e)
        {
            pImpl->monitor.logFailure("Kyber Encapsulation", e.what());
            throw;
        }
    }

    // Kyber Decapsulation
    SharedSecret QuantumCrypto::kyberDecapsulate(const Buffer &ciphertext, const PrivateKey &key)
    {
        std::lock_guard<std::mutex> lock(pImpl->mutex);

        try
        {
            validateSecurityLevel();

            SecureBuffer<uint8_t> sharedSecret(pImpl->kyber->length_shared_secret);

            int status = OQS_KEM_decaps(
                pImpl->kyber.get(),
                sharedSecret.data(),
                ciphertext.data(),
                key.data());

            if (status != OQS_SUCCESS)
            {
                throw QuantumError("Kyber decapsulation failed");
            }

            return SharedSecret(sharedSecret.data(), sharedSecret.size());
        }
        catch (const std::exception &e)
        {
            pImpl->monitor.logFailure("Kyber Decapsulation", e.what());
            throw;
        }
    }

    // Generate secure random bytes
    Buffer QuantumCrypto::generateSecureRandom(size_t length) const
    {
        Buffer result(length);
        if (RAND_bytes(result.data(), length) != 1)
        {
            throw QuantumError("Failed to generate secure random bytes");
        }
        return result;
    }

    // Health Check
    bool QuantumCrypto::healthCheck()
    {
        try
        {
            if (!pImpl->entropy.hasGoodQuality())
            {
                return false;
            }

            KeyPair testKeyPair = generateDilithiumKeyPair();
            Buffer testMessage = generateSecureRandom(32);
            Signature testSig = sign(testMessage, PrivateKey(testKeyPair.privateKey.data(), testKeyPair.privateKey.size()));

            if (!verify(testMessage, testSig, PublicKey(testKeyPair.publicKey.data(), testKeyPair.publicKey.size())))
            {
                return false;
            }

            checkForSideChannels();
            return true;
        }
        catch (...)
        {
            return false;
        }
    }

    // Validate Security Level
    void QuantumCrypto::validateSecurityLevel() const
    {
        if (!pImpl->monitor.isSecurityLevelMaintained())
        {
            throw QuantumError("Security level compromised");
        }
    }

    // Check for Side Channels
    void QuantumCrypto::checkForSideChannels() const
    {
        if (pImpl->monitor.detectSideChannelVulnerability())
        {
            throw QuantumError("Side-channel vulnerability detected");
        }
    }

    // Monitor Entropy
    void QuantumCrypto::monitorEntropy()
    {
        if (RAND_status() != 1)
        {
            throw QuantumError("Insufficient entropy available");
        }

        unsigned char buf[32];
        if (RAND_bytes(buf, sizeof(buf)) != 1)
        {
            throw QuantumError("Failed to generate random bytes - entropy pool may be depleted");
        }
    }

    // Initialize Security Monitor
    void QuantumCrypto::initializeSecurityMonitor()
    {
        pImpl->monitor.initialize();
    }

} // namespace quantum
