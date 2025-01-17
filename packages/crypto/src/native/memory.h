#pragma once

#include <openssl/crypto.h>
#include <type_traits>
#include <stdexcept>
#include <cstring>
#include <memory>
#include <string>
#include <vector>
#include <openssl/sha.h>
#include <openssl/bio.h>
#include <openssl/buffer.h>
#include <openssl/evp.h>

namespace quantum {

// Exception class for memory-related errors
class MemoryError : public std::runtime_error {
public:
    explicit MemoryError(const char* msg) : std::runtime_error(msg) {}
};

// Utility functions

// Constant-time comparison to prevent timing attacks
inline bool secureCompare(const void* a, const void* b, size_t length) {
    return CRYPTO_memcmp(a, b, length) == 0;
}

// Secure memory zeroing that won't be optimized away
inline void secureZero(void* ptr, size_t length) {
    OPENSSL_cleanse(ptr, length);
}

// Template class for secure buffer management
template<typename T>
class SecureBuffer {
public:
    // Constructor
    explicit SecureBuffer(size_t size) 
        : size_(size), data_(nullptr) 
    {
        if (size_ == 0) {
            throw MemoryError("Zero-sized buffer requested");
        }
        data_ = static_cast<T*>(OPENSSL_secure_malloc(size_ * sizeof(T)));
        if (!data_) {
            throw MemoryError("Secure memory allocation failed");
        }
    }

    // Destructor
    ~SecureBuffer() {
        if (data_) {
            secureZero(data_, size_ * sizeof(T));
            OPENSSL_secure_free(data_);
        }
    }

    // Delete copy constructor and copy assignment
    SecureBuffer(const SecureBuffer&) = delete;
    SecureBuffer& operator=(const SecureBuffer&) = delete;

    // Move constructor
    SecureBuffer(SecureBuffer&& other) noexcept 
        : size_(other.size_), data_(other.data_) 
    {
        other.data_ = nullptr;
        other.size_ = 0;
    }

    // Move assignment operator
    SecureBuffer& operator=(SecureBuffer&& other) noexcept {
        if (this != &other) {
            // Free existing resources
            if (data_) {
                secureZero(data_, size_ * sizeof(T));
                OPENSSL_secure_free(data_);
            }
            // Transfer ownership
            data_ = other.data_;
            size_ = other.size_;
            other.data_ = nullptr;
            other.size_ = 0;
        }
        return *this;
    }

    // Accessors
    T* data() { return data_; }
    const T* data() const { return data_; }
    size_t size() const { return size_; }

    // Secure comparison
    bool equals(const SecureBuffer& other) const {
        if (size_ != other.size_) return false;
        return secureCompare(data_, other.data_, size_ * sizeof(T));
    }

    // Secure zeroing
    void clear() {
        secureZero(data_, size_ * sizeof(T));
    }

private:
    size_t size_;
    T* data_;
};

// Utility function to create a secure buffer
template<typename T>
inline SecureBuffer<T> makeSecureBuffer(size_t size) {
    return SecureBuffer<T>(size);
}

// Buffer classes with secure memory handling

// Base Buffer class inheriting from SecureBuffer<uint8_t>
class Buffer : public SecureBuffer<uint8_t> {
public:
    explicit Buffer(size_t size) : SecureBuffer<uint8_t>(size) {}

    // Constructor from raw data
    Buffer(const uint8_t* data, size_t size) : SecureBuffer<uint8_t>(size) {
        std::memcpy(data(), data, size);
    }

    // Convert buffer to Base64 string
    std::string toBase64() const {
        BIO* bio, * b64;
        BUF_MEM* bufferPtr;
        b64 = BIO_new(BIO_f_base64());
        bio = BIO_new(BIO_s_mem());
        bio = BIO_push(b64, bio);
        BIO_set_flags(bio, BIO_FLAGS_BASE64_NO_NL);
        BIO_write(bio, data(), size());
        BIO_flush(bio);
        BIO_get_mem_ptr(bio, &bufferPtr);
        std::string base64_str(bufferPtr->data, bufferPtr->length);
        BIO_free_all(bio);
        return base64_str;
    }

    // Create Buffer from Base64 string
    static Buffer fromBase64(const std::string& base64) {
        BIO* bio, * b64;
        int decodeLen = base64.length();
        std::vector<uint8_t> buffer(decodeLen);
        b64 = BIO_new(BIO_f_base64());
        bio = BIO_new_mem_buf(base64.data(), decodeLen);
        bio = BIO_push(b64, bio);
        BIO_set_flags(bio, BIO_FLAGS_BASE64_NO_NL);
        int length = BIO_read(bio, buffer.data(), decodeLen);
        BIO_free_all(bio);
        if (length < 0) {
            throw MemoryError("Base64 decoding failed");
        }
        return Buffer(buffer.data(), length);
    }

    // Secure zeroing
    void zeroize() {
        clear();
    }
};

// PrivateKey class inheriting from Buffer
class PrivateKey : public Buffer {
public:
    using Buffer::Buffer;

    void zeroize() {
        clear();
    }
};

// PublicKey class inheriting from Buffer
class PublicKey : public Buffer {
public:
    using Buffer::Buffer;

    // Generate fingerprint using SHA-256
    std::string getFingerprint() const {
        unsigned char hash[SHA256_DIGEST_LENGTH];
        SHA256(data(), size(), hash);
        // Convert hash to hexadecimal string
        static const char hex_chars[] = "0123456789ABCDEF";
        std::string fingerprint;
        fingerprint.reserve(SHA256_DIGEST_LENGTH * 2);
        for (int i = 0; i < SHA256_DIGEST_LENGTH; ++i) {
            fingerprint += hex_chars[(hash[i] >> 4) & 0xF];
            fingerprint += hex_chars[hash[i] & 0xF];
        }
        return fingerprint;
    }
};

// Signature class inheriting from Buffer
class Signature : public Buffer {
public:
    using Buffer::Buffer;

    bool isValid() const {
        return size() > 0;
    }
};

// SharedSecret class inheriting from Buffer
class SharedSecret : public Buffer {
public:
    using Buffer::Buffer;

    void zeroize() {
        clear();
    }
};

} // namespace quantum