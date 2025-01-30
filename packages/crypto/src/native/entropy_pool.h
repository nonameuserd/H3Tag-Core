#ifndef ENTROPY_POOL_H
#define ENTROPY_POOL_H

#include <vector>
#include <cstddef>
#include <mutex>
#include <memory>

class EntropyPool
{
public:
    EntropyPool();
    ~EntropyPool() = default;

    std::vector<uint8_t> getBytes(size_t length);
    bool hasGoodQuality() const;

private:
    struct Implementation;
    std::unique_ptr<Implementation> pImpl;
};

#endif // ENTROPY_POOL_H