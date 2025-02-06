#ifndef SECURITY_MONITOR_H
#define SECURITY_MONITOR_H

#include <string>
#include <memory>

class SecurityMonitor
{
public:
    SecurityMonitor();
    ~SecurityMonitor() = default;

    // Explicitly delete copy and move semantics
    SecurityMonitor(const SecurityMonitor &) = delete;
    SecurityMonitor(SecurityMonitor &&) = delete;
    SecurityMonitor &operator=(const SecurityMonitor &) = delete;
    SecurityMonitor &operator=(SecurityMonitor &&) = delete;

    void logFailure(const std::string &operation, const std::string &error);
    bool isSecurityLevelMaintained() const;
    bool detectSideChannelVulnerability() const;
    void initialize();

private:
    struct Implementation;
    std::unique_ptr<Implementation> pImpl;
};

#endif // SECURITY_MONITOR_H