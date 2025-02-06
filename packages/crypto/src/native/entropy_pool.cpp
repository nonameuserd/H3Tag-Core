#include "entropy_pool.h"
#include <openssl/rand.h>
#include <stdexcept>
#include <mutex>
#include <atomic>
#include <vector>

struct EntropyPool::Implementation
{
    std::mutex mutex;
    std::atomic<size_t> entropyLevel{0};
    const size_t MIN_ENTROPY_LEVEL = 256; // Minimum acceptable entropy level

    Implementation()
    {
        if (RAND_status() != 1)
        {
            throw std::runtime_error("Insufficient entropy available");
        }
    }
};

EntropyPool::EntropyPool()
    : pImpl(std::make_unique<Implementation>()) {}

// Define the destructor here to ensure that Implementation is complete.
EntropyPool::~EntropyPool() = default;

std::vector<uint8_t> EntropyPool::getBytes(size_t length)
{
    std::lock_guard<std::mutex> lock(pImpl->mutex);
    std::vector<uint8_t> bytes(length);

    if (RAND_bytes(bytes.data(), static_cast<int>(length)) != 1)
    {
        throw std::runtime_error("Failed to generate random bytes");
    }

    pImpl->entropyLevel += length;
    return bytes;
}

bool EntropyPool::hasGoodQuality() const
{
    return pImpl->entropyLevel.load() >= pImpl->MIN_ENTROPY_LEVEL;
}
