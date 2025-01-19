cmake_minimum_required(VERSION 3.15)
project(quantum-safe-blockchain VERSION 0.1.0)

# Add version check for liboqs
find_package(PkgConfig REQUIRED)
pkg_check_modules(LIBOQS REQUIRED IMPORTED_TARGET liboqs>=0.12.0)

# Platform-specific settings
if(APPLE)
    set(LIBOQS_ROOT "/opt/homebrew/Cellar/liboqs/0.12.0" CACHE PATH "Path to liboqs installation")
elseif(UNIX)
    set(LIBOQS_ROOT "/usr/local" CACHE PATH "Path to liboqs installation")
endif()

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)

# Node addon settings
include_directories(
    ${CMAKE_JS_INC}
    ${LIBOQS_ROOT}/include
    ${CMAKE_SOURCE_DIR}/src/crypto/native
)

add_library(${PROJECT_NAME} SHARED 
    packages/crypto/src/native/quantum.cpp
)

set_target_properties(${PROJECT_NAME} PROPERTIES 
    PREFIX ""
    SUFFIX ".node"
    LIBRARY_OUTPUT_DIRECTORY "${CMAKE_SOURCE_DIR}/dist"
)

target_link_libraries(${PROJECT_NAME}
    PRIVATE
    ${CMAKE_JS_LIB}
    ${LIBOQS_ROOT}/lib/liboqs.a
)

# Install targets
install(TARGETS ${PROJECT_NAME}
    LIBRARY DESTINATION lib
    RUNTIME DESTINATION bin
)

# Testing
# enable_testing()
# add_subdirectory(test)