#include "security_monitor.h"
#include <mutex>
#include <chrono>
#include <atomic>
#include <iostream>
#include <sstream>
#include <iomanip>
#include <ctime>
#include <fstream>

struct SecurityMonitor::Implementation
{
    std::mutex mutex;
    std::atomic<bool> securityLevelMaintained{true};
    std::atomic<bool> sideChannelDetected{false};
    std::chrono::steady_clock::time_point lastCheck;

    Implementation() : lastCheck(std::chrono::steady_clock::now()) {}
};

SecurityMonitor::SecurityMonitor()
    : pImpl(std::make_unique<Implementation>()) {}

void SecurityMonitor::logFailure(const std::string &operation, const std::string &error)
{
    std::lock_guard<std::mutex> lock(pImpl->mutex);
    // Get current timestamp
    auto now = std::chrono::system_clock::now();
    auto now_time_t = std::chrono::system_clock::to_time_t(now);

    // Format the log message
    std::stringstream logMessage;
    logMessage << "[" << std::put_time(std::localtime(&now_time_t), "%Y-%m-%d %H:%M:%S") << "] "
               << "Security Failure - Operation: " << operation
               << ", Error: " << error << "\n";

    // Output to standard error (can be redirected to a file)
    std::cerr << logMessage.str();

    // Write to a log file
    std::ofstream logFile("security_errors.log", std::ios::app);
    if (logFile.is_open())
    {
        logFile << logMessage.str();
    }
}

bool SecurityMonitor::isSecurityLevelMaintained() const
{
    std::lock_guard<std::mutex> lock(pImpl->mutex);
    return pImpl->securityLevelMaintained.load();
}

bool SecurityMonitor::detectSideChannelVulnerability() const
{
    std::lock_guard<std::mutex> lock(pImpl->mutex);
    return pImpl->sideChannelDetected.load();
}

void SecurityMonitor::initialize()
{
    std::lock_guard<std::mutex> lock(pImpl->mutex);
    pImpl->securityLevelMaintained = true;
    pImpl->sideChannelDetected = false;
    pImpl->lastCheck = std::chrono::steady_clock::now();
}