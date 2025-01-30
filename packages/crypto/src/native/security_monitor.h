#ifndef SECURITY_MONITOR_H
#define SECURITY_MONITOR_H

#include <string>
#include <memory>

class SecurityMonitor
{
public:
    SecurityMonitor();
    ~SecurityMonitor() = default;

    void logFailure(const std::string &operation, const std::string &error);
    bool isSecurityLevelMaintained() const;
    bool detectSideChannelVulnerability() const;
    void initialize();

private:
    struct Implementation;
    std::unique_ptr<Implementation> pImpl;
};

#endif // SECURITY_MONITOR_H